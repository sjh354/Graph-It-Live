/**
 * Dart call graph extraction.
 *
 * Dart is read with the shared syntactic scanner (`dartSyntax`) instead of a
 * tree-sitter query: the grammar WASM is not part of this build, and Dart's
 * `package:` imports are resolved outside the syntax tree. Declarations become
 * nodes; same-file calls and supertype clauses become edges; a target defined
 * nowhere in the file keeps its name as an `@@external:` stub, which
 * CallGraphIndexer resolves workspace-wide by name. A constructor is folded
 * into its class node so `HomePage()` has one target.
 *
 * Evidence is syntactic (DESIGN 4.1): a call by name is a candidate until the
 * indexer finds that symbol, and unresolved stubs are deleted rather than kept.
 *
 * NO vscode imports — this module is VS Code-agnostic.
 */

import type { RelationType, SymbolType } from "@/shared/callgraph-types";
import {
  type DartDeclaration,
  findCallSites,
  maskDart,
  parseDartDeclarations,
} from "../languages/dartSyntax";
import type { CallGraphEdge, CallGraphNode } from "./CallGraphIndexer";

export interface DartExtractionResult {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
}

const SYMBOL_TYPE: Record<DartDeclaration["kind"], SymbolType> = {
  class: "class",
  interface: "interface",
  type: "type",
  function: "function",
  method: "method",
  variable: "variable",
};

/** 0-based line/column of an offset into the source. */
function positionAt(source: string, index: number): { line: number; column: number } {
  const prefix = source.slice(0, Math.max(0, index));
  const lines = prefix.split("\n");
  return { line: lines.length - 1, column: (lines[lines.length - 1] ?? "").length };
}

const isConstructor = (declaration: DartDeclaration): boolean =>
  declaration.kind === "method" && declaration.parentName === declaration.name;

const qualifiedName = (declaration: DartDeclaration): string =>
  declaration.parentName ? `${declaration.parentName}.${declaration.name}` : declaration.name;

/** Extract the supertype clauses of a class/mixin header (offsets from `startIndex`). */
function supertypeNames(header: string): Array<{ name: string; relation: RelationType }> {
  const found: Array<{ name: string; relation: RelationType }> = [];
  const single = (pattern: RegExp, relation: RelationType): void => {
    const match = pattern.exec(header);
    if (match?.[1]) found.push({ name: match[1].trim(), relation });
  };
  // `with A, B` and `implements X, Y` are lists; keep the first identifier of
  // each entry so generics (`Foo<T>`) do not leak into the name.
  const list = (pattern: RegExp, relation: RelationType): void => {
    const match = pattern.exec(header);
    if (!match?.[1]) return;
    for (const entry of match[1].split(",")) {
      const name = /^[A-Za-z_][\w.]*/.exec(entry.trim().replace(/<[\s\S]*>/, ""))?.[0];
      if (name) found.push({ name, relation });
    }
  };

  single(/extends\s+([A-Za-z_][\w.]*)/, "INHERITS");
  // Each list stops at the next clause keyword, not just at the body brace.
  list(/\bwith\s+([\w.<>,\s]+?)(?=\s+(?:implements|on)\b|[{;]|$)/, "INHERITS");
  list(/\bimplements\s+([\w.<>,\s]+?)(?=\s+on\b|[{;]|$)/, "IMPLEMENTS");
  list(/\bon\s+([\w.<>,\s]+?)(?=\s+implements\b|[{;]|$)/, "USES");
  return found;
}

export function extractDart(
  source: string,
  normalizedPath: string,
  folder: string,
): DartExtractionResult {
  const code = maskDart(source);
  const declarations = parseDartDeclarations(source);

  const nodes: CallGraphNode[] = [];
  const nodeIdByDeclaration = new Map<DartDeclaration, string>();
  const byName = new Map<string, DartDeclaration[]>();

  for (const declaration of declarations) {
    if (isConstructor(declaration)) continue; // `HomePage()` targets the class node
    const start = positionAt(source, declaration.startIndex);
    const end = positionAt(source, declaration.endIndex);
    const id = `${normalizedPath}:${qualifiedName(declaration)}:${start.line}`;
    nodeIdByDeclaration.set(declaration, id);
    const existing = byName.get(declaration.name);
    if (existing) existing.push(declaration);
    else byName.set(declaration.name, [declaration]);
    nodes.push({
      id,
      name: declaration.name,
      type: SYMBOL_TYPE[declaration.kind],
      lang: "dart",
      path: normalizedPath,
      folder,
      startLine: start.line,
      endLine: end.line,
      startCol: start.column,
      isExported: declaration.isExported,
    });
  }

  const edgeKeys = new Set<string>();
  const edges: CallGraphEdge[] = [];
  const pushEdge = (sourceId: string, targetId: string, relation: RelationType, sourceLine: number): void => {
    const key = `${sourceId}->${targetId}->${relation}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ sourceId, targetId, typeRelation: relation, sourceLine });
  };

  /** Resolve a called/supertype name: same class first, then top level, then any. */
  const resolveByName = (name: string, caller?: DartDeclaration): string => {
    const candidates = byName.get(name);
    if (!candidates || candidates.length === 0) return `@@external:${name}`;
    const sameClass = caller?.parentName
      ? candidates.find((candidate) => candidate.parentName === caller.parentName)
      : undefined;
    const target =
      sameClass ??
      candidates.find((candidate) => !candidate.parentName) ??
      candidates[0];
    return nodeIdByDeclaration.get(target) ?? `@@external:${name}`;
  };

  for (const declaration of declarations) {
    const sourceId = nodeIdByDeclaration.get(declaration);
    if (!sourceId) continue;

    if (declaration.kind === "function" || declaration.kind === "method") {
      for (const call of findCallSites(code, declaration)) {
        pushEdge(sourceId, resolveByName(call.name, declaration), "CALLS", call.line - 1);
      }
    }

    if (declaration.kind === "class" || declaration.kind === "type") {
      const header = source.slice(declaration.startIndex, declaration.endIndex);
      for (const supertype of supertypeNames(header)) {
        if (supertype.name === declaration.name) continue;
        pushEdge(sourceId, resolveByName(supertype.name, declaration), supertype.relation, declaration.line - 1);
      }
    }
  }

  return { nodes, edges };
}
