import fs from "node:fs/promises";
import path from "node:path";
import { normalizePath } from "../../shared/path";
import { isPathWithinRootCanonical } from "../../shared/pathSecurity";
import { FileReader } from "../FileReader";
import { Dependency, ILanguageAnalyzer, SpiderError } from "../types";
import { extractFilePath } from "../utils/PathExtractor";

/**
 * Dart dependency parser.
 *
 * Dart's directive syntax is regular (`import '…';`), and the interesting part
 * is resolution: `package:` URIs point into `lib/` through
 * `.dart_tool/package_config.json` or the package's own pubspec name, while
 * relative URIs resolve against the importing file. There is no WASM parser
 * here because the tree-sitter Dart grammar cannot express that mapping.
 *
 * Evidence is syntactic only: conditional imports keep their first target, and
 * packages outside the workspace are reported as unresolved rather than guessed.
 */

interface PackageConfig {
  /** package name → absolute root directory (…/lib) */
  packages: Map<string, string>;
  /** The package that owns the queried file */
  ownPackage?: { name: string; libDir: string };
}

const DIRECTIVE = /^[ \t]*(import|export|part)\s+['"]([^'"]+)['"]/gm;
const CONDITIONAL = /if\s*\([^)]*\)\s*['"]([^'"]+)['"]/g;

export class DartParser implements ILanguageAnalyzer {
  private readonly fileReader = new FileReader();
  private readonly rootDir: string;
  private readonly packageConfigs = new Map<string, Promise<PackageConfig>>();

  constructor(rootDir?: string, _extensionPath?: string) {
    this.rootDir = rootDir ?? process.cwd();
  }

  async parseImports(filePath: string): Promise<Dependency[]> {
    const actualPath = extractFilePath(filePath);

    let content: string;
    try {
      content = await this.fileReader.readFile(actualPath);
    } catch (error) {
      throw SpiderError.fromError(error, actualPath);
    }

    const dependencies: Dependency[] = [];
    const seen = new Set<string>();

    for (const match of content.matchAll(DIRECTIVE)) {
      const [, keyword, uri] = match;
      const line = content.slice(0, match.index ?? 0).split("\n").length;
      this.pushDirective(dependencies, seen, keyword, uri, line);

      // `import 'web.dart' if (dart.library.io) 'io.dart';` — both targets exist.
      const restOfLine = content.slice(match.index).split("\n", 1)[0] ?? "";
      for (const conditional of restOfLine.matchAll(CONDITIONAL)) {
        this.pushDirective(dependencies, seen, keyword, conditional[1], line);
      }
    }

    return dependencies;
  }

  private pushDirective(
    dependencies: Dependency[],
    seen: Set<string>,
    keyword: string,
    uri: string,
    line: number,
  ): void {
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    dependencies.push({
      path: "",
      type: keyword === "export" ? "export" : "import",
      line,
      module: uri,
    });
  }

  async resolvePath(fromFile: string, moduleSpecifier: string): Promise<string | null> {
    try {
      const actualFrom = extractFilePath(fromFile);

      // `dart:async`, `dart:io` — SDK libraries have no file in the workspace.
      if (moduleSpecifier.startsWith("dart:")) return null;

      if (moduleSpecifier.startsWith("package:")) {
        return await this.resolvePackageImport(actualFrom, moduleSpecifier);
      }

      // Dart has no absolute file imports; anything else is relative to the file.
      const target = path.resolve(path.dirname(actualFrom), moduleSpecifier);
      if (!this.isWithinRoot(target)) return null;
      return (await this.fileExists(target)) ? normalizePath(target) : null;
    } catch {
      return null;
    }
  }

  private async resolvePackageImport(fromFile: string, specifier: string): Promise<string | null> {
    const withoutScheme = specifier.slice("package:".length);
    const slash = withoutScheme.indexOf("/");
    if (slash <= 0) return null;

    const packageName = withoutScheme.slice(0, slash);
    const relative = withoutScheme.slice(slash + 1);
    if (relative.split("/").some((part) => part === ".." || part === "")) return null;

    const config = await this.loadPackageConfig(fromFile);
    const libDir =
      config.packages.get(packageName) ??
      (config.ownPackage?.name === packageName ? config.ownPackage.libDir : undefined);
    if (!libDir) return null;

    const target = path.join(libDir, relative);
    if (!this.isWithinRoot(target)) return null;
    return (await this.fileExists(target)) ? normalizePath(target) : null;
  }

  /** Reads `.dart_tool/package_config.json` or the owning pubspec, once per root. */
  private loadPackageConfig(fromFile: string): Promise<PackageConfig> {
    const cached = this.packageConfigs.get(this.rootDir);
    if (cached) return cached;

    const loaded = this.readPackageConfig(fromFile);
    this.packageConfigs.set(this.rootDir, loaded);
    return loaded;
  }

  private async readPackageConfig(fromFile: string): Promise<PackageConfig> {
    const config: PackageConfig = { packages: new Map() };

    const configPath = await this.findUp(path.dirname(fromFile), ".dart_tool/package_config.json");
    if (configPath) {
      try {
        const raw = JSON.parse(await fs.readFile(configPath, "utf8")) as {
          packages?: Array<{ name?: string; rootUri?: string }>;
        };
        const configDir = path.dirname(configPath);
        for (const entry of raw.packages ?? []) {
          if (!entry.name || !entry.rootUri) continue;
          const root = entry.rootUri.startsWith("file://")
            ? decodeURIComponent(entry.rootUri.slice("file://".length))
            : path.resolve(configDir, entry.rootUri);
          config.packages.set(entry.name, path.join(root, "lib"));
        }
      } catch {
        // A malformed config is reported as unresolved imports, not a crash.
      }
    }

    const pubspecPath = await this.findUp(path.dirname(fromFile), "pubspec.yaml");
    if (pubspecPath) {
      try {
        const pubspec = await fs.readFile(pubspecPath, "utf8");
        const name = /^name:\s*([A-Za-z0-9_]+)\s*$/m.exec(pubspec)?.[1];
        if (name) {
          config.ownPackage = { name, libDir: path.join(path.dirname(pubspecPath), "lib") };
        }
      } catch {
        // Same: absence of a name just leaves package imports unresolved.
      }
    }

    return config;
  }

  /** Walk up from `startDir` to the workspace root looking for `needle`. */
  private async findUp(startDir: string, needle: string): Promise<string | null> {
    let dir = startDir;
    for (;;) {
      const candidate = path.join(dir, needle);
      // Sequential by design: stop at the first ancestor that has the file.
      // eslint-disable-next-line no-await-in-loop
      if (await this.fileExists(candidate)) return candidate;
      const parent = path.dirname(dir);
      // Never look above the workspace root: that would leak other projects.
      if (parent === dir || !this.isWithinRoot(parent)) return null;
      dir = parent;
    }
  }

  private isWithinRoot(candidate: string): boolean {
    return isPathWithinRootCanonical(candidate, this.rootDir);
  }

  private async fileExists(candidate: string): Promise<boolean> {
    try {
      const stats = await fs.stat(candidate);
      return stats.isFile();
    } catch {
      return false;
    }
  }
}
