import { normalizePath } from "../../shared/path";
import { FileReader } from "../FileReader";
import { ISymbolAnalyzer, SpiderError, SymbolDependency, SymbolInfo } from "../types";
import { extractFilePath } from "../utils/PathExtractor";
import {
  type DartDeclaration,
  findCallSites,
  maskDart,
  parseDartDeclarations,
} from "./dartSyntax";

/**
 * Dart symbol analyzer.
 *
 * Declarations come from `dartSyntax` (syntactic scan). Calls whose target is
 * declared in the same file become symbol dependencies with their call-site
 * line. A call to a name that is not declared here is left out rather than
 * guessed: cross-file resolution needs the call-graph index, and an unresolved
 * call must stay unresolved (DESIGN 4.1).
 */
export class DartSymbolAnalyzer implements ISymbolAnalyzer {
  private readonly fileReader = new FileReader();

  constructor(_rootDir?: string, _extensionPath?: string) {
    // Kept for the LanguageService signature; Dart analysis needs no WASM.
  }

  async analyzeFile(filePath: string): Promise<Map<string, SymbolInfo>> {
    try {
      return (await this.analyze(filePath)).symbols;
    } catch (error) {
      throw SpiderError.fromError(error, filePath);
    }
  }

  async getSymbolDependencies(filePath: string): Promise<SymbolDependency[]> {
    try {
      return (await this.analyze(filePath)).dependencies;
    } catch (error) {
      throw SpiderError.fromError(error, filePath);
    }
  }

  private async analyze(
    filePath: string,
  ): Promise<{ symbols: Map<string, SymbolInfo>; dependencies: SymbolDependency[] }> {
    const actualPath = extractFilePath(filePath);
    const normalizedPath = normalizePath(actualPath);
    const source = await this.fileReader.readFile(actualPath);
    const declarations = parseDartDeclarations(source);
    const code = maskDart(source);

    const symbolId = (declaration: DartDeclaration): string =>
      declaration.parentName
        ? `${normalizedPath}:${declaration.parentName}.${declaration.name}`
        : `${normalizedPath}:${declaration.name}`;

    const symbols = new Map<string, SymbolInfo>();
    const byName = new Map<string, DartDeclaration[]>();

    // Classes first so members can point at their parent symbol.
    for (const declaration of declarations) {
      if (declaration.kind === "class" || declaration.kind === "type") {
        symbols.set(symbolId(declaration), {
          name: declaration.name,
          kind: declaration.kind === "type" ? "Type" : "Class",
          line: declaration.line,
          isExported: declaration.isExported,
          id: symbolId(declaration),
          category: declaration.kind === "type" ? "type" : "class",
        });
      }
    }

    for (const declaration of declarations) {
      if (declaration.kind === "class" || declaration.kind === "type") {
        byName.set(declaration.name, [declaration, ...(byName.get(declaration.name) ?? [])]);
        continue;
      }

      const id = symbolId(declaration);
      const parent = declaration.parentName
        ? declarations.find(
            (candidate) =>
              candidate.name === declaration.parentName &&
              (candidate.kind === "class" || candidate.kind === "type"),
          )
        : undefined;
      symbols.set(id, {
        name: declaration.name,
        kind: declaration.kind === "variable" ? "Variable" : declaration.parentName ? "Method" : "Function",
        line: declaration.line,
        isExported: declaration.isExported,
        id,
        ...(parent ? { parentSymbolId: symbolId(parent) } : {}),
        category: declaration.kind === "variable" ? "variable" : "function",
      });
      byName.set(declaration.name, [declaration, ...(byName.get(declaration.name) ?? [])]);
    }

    const dependencies: SymbolDependency[] = [];
    const seen = new Set<string>();

    for (const declaration of declarations) {
      // Calls belong to the innermost declaration; a class body would
      // otherwise attribute every member's calls to the class itself.
      if (declaration.kind === "class" || declaration.kind === "type" || declaration.kind === "variable") {
        continue;
      }
      const sourceId = symbolId(declaration);
      if (!symbols.has(sourceId)) continue;
      for (const call of findCallSites(code, declaration)) {
        const candidates = byName.get(call.name);
        if (!candidates || candidates.length === 0) continue;
        // Prefer a member of the same class, then a top-level function.
        const target =
          candidates.find((candidate) => candidate.parentName === declaration.parentName) ??
          candidates.find((candidate) => !candidate.parentName) ??
          candidates[0];
        if (!target || symbolId(target) === sourceId) continue;

        const key = `${sourceId}->${symbolId(target)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dependencies.push({
          sourceSymbolId: sourceId,
          targetSymbolId: symbolId(target),
          targetFilePath: normalizedPath,
          line: call.line,
        });
      }
    }

    return { symbols, dependencies };
  }
}
