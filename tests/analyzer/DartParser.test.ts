import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DartParser } from "@/analyzer/languages/DartParser";
import { normalizePath } from "@/shared/path";

let root: string;
let parser: DartParser;

const write = (relative: string, content: string): string => {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
};

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "dart-parser-"));
  write("pubspec.yaml", "name: ggultarae\nenvironment:\n  sdk: '>=3.0.0 <4.0.0'\n");
  write("lib/main.dart", "void main() {}\n");
  write("lib/models/user.dart", "class User {}\n");
  write("lib/src/screen.dart", [
    "import 'dart:async';",
    "import 'package:flutter/material.dart';",
    "import 'package:ggultarae/models/user.dart';",
    "import '../main.dart';",
    "import 'screen_config.dart' if (dart.library.io) 'screen_io.dart';",
    "export 'screen_parts.dart';",
    "part 'screen.g.dart';",
    "part of 'other.dart';",
    "",
    "class Screen {}",
    "",
  ].join("\n"));
  write("lib/src/screen_config.dart", "class Config {}\n");
  write("lib/src/screen_io.dart", "class IoConfig {}\n");
  write("lib/src/screen_parts.dart", "class Parts {}\n");
  write("lib/src/screen.g.dart", "part of 'screen.dart';\n");
  write(
    ".dart_tool/package_config.json",
    JSON.stringify({
      configVersion: 2,
      packages: [
        { name: "ggultarae", rootUri: "../" },
        { name: "flutter", rootUri: "file:///opt/flutter/packages/flutter" },
      ],
    }),
  );
  parser = new DartParser(root);
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("DartParser", () => {
  it("reads import, export and part directives with their lines", async () => {
    const deps = await parser.parseImports(path.join(root, "lib/src/screen.dart"));

    expect(deps.map((dependency) => dependency.module)).toEqual([
      "dart:async",
      "package:flutter/material.dart",
      "package:ggultarae/models/user.dart",
      "../main.dart",
      "screen_config.dart",
      "screen_io.dart",
      "screen_parts.dart",
      "screen.g.dart",
    ]);
    expect(deps.find((dependency) => dependency.module === "../main.dart")?.line).toBe(4);
    expect(deps.find((dependency) => dependency.module === "screen_parts.dart")?.type).toBe("export");
    // `part of` belongs to another file and is not a dependency.
    expect(deps.some((dependency) => dependency.module === "other.dart")).toBe(false);
  });

  it("resolves relative imports to workspace files", async () => {
    const from = path.join(root, "lib/src/screen.dart");

    await expect(parser.resolvePath(from, "../main.dart")).resolves.toBe(
      normalizePath(path.join(root, "lib/main.dart")),
    );
    await expect(parser.resolvePath(from, "missing.dart")).resolves.toBeNull();
  });

  it("resolves the package's own package: URIs through pubspec and package_config", async () => {
    const from = path.join(root, "lib/src/screen.dart");

    await expect(parser.resolvePath(from, "package:ggultarae/models/user.dart")).resolves.toBe(
      normalizePath(path.join(root, "lib/models/user.dart")),
    );
  });

  it("leaves SDK and out-of-workspace packages unresolved", async () => {
    const from = path.join(root, "lib/src/screen.dart");

    await expect(parser.resolvePath(from, "dart:async")).resolves.toBeNull();
    await expect(parser.resolvePath(from, "package:flutter/material.dart")).resolves.toBeNull();
  });

  it("refuses to escape the workspace root", async () => {
    const from = path.join(root, "lib/src/screen.dart");

    await expect(parser.resolvePath(from, "../../../../etc/passwd")).resolves.toBeNull();
    await expect(parser.resolvePath(from, "package:ggultarae/../../secret.dart")).resolves.toBeNull();
  });
});
