/**
 * Feature registration per language (DESIGN 4.2, 11).
 *
 * A feature asks this registry instead of assuming every language behaves like
 * TypeScript. Missing capabilities become explicit "unsupported" entries in the
 * structure scope, so the UI can say what it did not examine (DESIGN 4.3)
 * rather than showing an empty graph that looks complete.
 *
 * NO vscode imports — this module is VS Code-agnostic.
 */

import path from "node:path";

export interface LanguageCapabilities {
  /** File-to-file imports in the file graph */
  fileImports: boolean;
  /** Declarations for the symbol view */
  symbols: boolean;
  /** Symbol-to-symbol calls inside one file */
  intraFileCalls: boolean;
  /** Cross-file call graph index (callers/callees) */
  crossFileCalls: boolean;
  /** Incoming calls via the language server */
  incomingCalls: boolean;
}

const FULL: LanguageCapabilities = {
  fileImports: true,
  symbols: true,
  intraFileCalls: true,
  crossFileCalls: true,
  incomingCalls: true,
};

/** Dart is the first adapter built outside the tree-sitter pipeline. */
const DART: LanguageCapabilities = {
  fileImports: true,
  symbols: true,
  intraFileCalls: true,
  crossFileCalls: false,
  incomingCalls: true,
};

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".vue": "vue",
  ".svelte": "svelte",
  ".gql": "graphql",
  ".graphql": "graphql",
  ".py": "python",
  ".pyi": "python",
  ".rs": "rust",
  ".toml": "rust",
  ".cs": "csharp",
  ".csproj": "csharp",
  ".go": "go",
  ".java": "java",
  ".dart": "dart",
};

/** Language key for a file path, or undefined when no analyzer claims it. */
export function languageForPath(filePath: string): string | undefined {
  return LANGUAGE_BY_EXTENSION[path.extname(filePath).toLowerCase()];
}

/**
 * Capabilities of the analyzer for this file. An unknown extension claims
 * nothing at all, which is how the scope reports it as unsupported.
 */
export function capabilitiesFor(filePath: string): LanguageCapabilities {
  const language = languageForPath(filePath);
  if (language === "dart") return DART;
  if (language === undefined) {
    return { fileImports: false, symbols: false, intraFileCalls: false, crossFileCalls: false, incomingCalls: false };
  }
  return FULL;
}

/** Human-readable gaps for the structure scope. */
export function unsupportedFeatures(filePath: string): string[] {
  const capabilities = capabilitiesFor(filePath);
  const gaps: string[] = [];
  if (!capabilities.fileImports) gaps.push("file imports");
  if (!capabilities.symbols) gaps.push("symbols");
  if (!capabilities.intraFileCalls) gaps.push("intra-file calls");
  if (!capabilities.crossFileCalls) gaps.push("cross-file call graph");
  if (!capabilities.incomingCalls) gaps.push("incoming calls");
  return gaps;
}
