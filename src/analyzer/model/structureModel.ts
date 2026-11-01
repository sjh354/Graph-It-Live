/**
 * Common structure model (DESIGN 5.1).
 *
 * The existing analyzers each produce their own payload: the file graph yields
 * path→path import edges, the symbol view yields symbol dependencies, and the
 * call graph yields serialized call nodes. Before a feature is exposed, this
 * module converts those payloads into one shape that keeps apart
 *
 *  - what a node is (file vs symbol) and where it is declared,
 *  - how two nodes relate (import vs call vs reference),
 *  - where the evidence is and how sure the analyzer is,
 *  - what stayed unresolved (a name with no target) instead of guessing.
 *
 * Conversion never re-analyzes and never fills gaps: an unresolved target is
 * represented with `targetName` and `certainty: "unresolved"`.
 *
 * NO vscode imports — this module is VS Code-agnostic.
 */

import { normalizePath } from "@/shared/path";
import type { SerializedCallEdge, SerializedCallNode } from "@/shared/callgraph-types";

export const STRUCTURE_MODEL_VERSION = 1 as const;

export type StructureNodeKind = "file" | "symbol";

export type StructureRelationKind = "IMPORTS" | "CALLS" | "INHERITS" | "IMPLEMENTS" | "USES" | "CONTAINS";

/** Where a fact came from: syntax only, semantic resolution, or framework rules. */
export type EvidenceSource = "syntax" | "semantic" | "framework";

/** Confirmed by name/target, estimated by a heuristic, or left unresolved on purpose. */
export type Certainty = "confirmed" | "estimated" | "unresolved";

export interface SourceLocation {
  path: string;
  /** 1-based line */
  line: number;
  /** 0-based column */
  column?: number;
}

export interface StructureNode {
  id: string;
  kind: StructureNodeKind;
  name: string;
  language: string;
  path: string;
  range?: { startLine: number; endLine?: number };
  /** Containing class/namespace, or the file for a symbol */
  parentId?: string;
  exported?: boolean;
}

export interface StructureRelation {
  id: string;
  kind: StructureRelationKind;
  sourceId: string;
  /** Absent when the target could not be identified. */
  targetId?: string;
  /** Kept when `targetId` is absent so the UI can still show the reference. */
  targetName?: string;
  locations: SourceLocation[];
  evidence: EvidenceSource;
  certainty: Certainty;
}

export interface StructureScope {
  root: string;
  languages: string[];
  /** Paths the analyzer was configured not to read. */
  excluded: string[];
  /** Facts this analyzer cannot produce for the scope. */
  unsupported: string[];
}

export interface StructureIssue {
  kind: "unresolved-import" | "unresolved-call" | "unsupported-language";
  message: string;
  location?: SourceLocation;
}

export interface StructureModel {
  schemaVersion: typeof STRUCTURE_MODEL_VERSION;
  scope: StructureScope;
  nodes: StructureNode[];
  relations: StructureRelation[];
  issues: StructureIssue[];
  generatedAt: number;
}

export interface ConversionOptions {
  evidence?: EvidenceSource;
  certainty?: Certainty;
}

const relationId = (kind: StructureRelationKind, sourceId: string, target: string): string =>
  `${kind}:${sourceId}->${target}`;

/** One model from already-converted parts; ids are de-duplicated in place. */
export function createStructureModel(
  scope: StructureScope,
  nodes: StructureNode[],
  relations: StructureRelation[],
  issues: StructureIssue[] = [],
): StructureModel {
  const nodeIds = new Set<string>();
  const uniqueNodes = nodes.filter((node) => {
    if (nodeIds.has(node.id)) return false;
    nodeIds.add(node.id);
    return true;
  });
  const relationIds = new Set<string>();
  const uniqueRelations = relations.filter((relation) => {
    if (relationIds.has(relation.id)) return false;
    relationIds.add(relation.id);
    return true;
  });
  return {
    schemaVersion: STRUCTURE_MODEL_VERSION,
    scope,
    nodes: uniqueNodes,
    relations: uniqueRelations,
    issues,
    generatedAt: Date.now(),
  };
}

export interface FileGraphInput {
  filePath: string;
  nodes: string[];
  edges: Array<{ source: string; target: string; sourceLine?: number }>;
  nodeLabels?: Record<string, string>;
}

/**
 * File graph → model. Each edge is an IMPORTS relation between two file nodes,
 * which is deliberately a different relation kind from a symbol CALLS edge.
 */
export function fileGraphToModel(input: FileGraphInput, language: string): {
  nodes: StructureNode[];
  relations: StructureRelation[];
} {
  const nodes: StructureNode[] = input.nodes.map((filePath) => ({
    id: filePath,
    kind: "file",
    name: input.nodeLabels?.[filePath] ?? filePath.split(/[\\/]/).pop() ?? filePath,
    language,
    path: filePath,
  }));

  const relations: StructureRelation[] = input.edges.map((edge) => ({
    id: relationId("IMPORTS", edge.source, edge.target),
    kind: "IMPORTS",
    sourceId: edge.source,
    targetId: edge.target,
    locations: edge.sourceLine ? [{ path: edge.source, line: edge.sourceLine }] : [],
    evidence: "syntax",
    certainty: "confirmed",
  }));

  return { nodes, relations };
}

export interface SymbolGraphInput {
  filePath: string;
  symbols: Array<{
    id: string;
    name: string;
    kind: string;
    line: number;
    endLine?: number;
    parentSymbolId?: string;
    isExported?: boolean;
  }>;
  dependencies: Array<{
    sourceSymbolId: string;
    targetSymbolId: string;
    targetFilePath: string;
    line?: number;
  }>;
}

/**
 * Symbol graph → model. Dependencies that point outside the file keep their
 * target id (the symbol is identified, only the file differs); a dependency
 * with no line is still a relation, it just has no location.
 */
export function symbolGraphToModel(
  input: SymbolGraphInput,
  language: string,
  options: ConversionOptions = {},
): { nodes: StructureNode[]; relations: StructureRelation[] } {
  const fileId = normalizePath(input.filePath);
  const nodes: StructureNode[] = input.symbols.map((symbol) => ({
    id: symbol.id,
    kind: "symbol",
    name: symbol.name,
    language,
    path: fileId,
    range: { startLine: symbol.line, ...(symbol.endLine !== undefined ? { endLine: symbol.endLine } : {}) },
    parentId: symbol.parentSymbolId ?? fileId,
    exported: symbol.isExported,
  }));

  const relations: StructureRelation[] = input.dependencies.map((dependency) => ({
    id: relationId("CALLS", dependency.sourceSymbolId, dependency.targetSymbolId),
    kind: "CALLS",
    sourceId: dependency.sourceSymbolId,
    targetId: dependency.targetSymbolId,
    locations: dependency.line
      ? [{ path: normalizePath(dependency.targetFilePath), line: dependency.line }]
      : [],
    evidence: options.evidence ?? "syntax",
    certainty: options.certainty ?? "estimated",
  }));

  return { nodes, relations };
}

export interface CallGraphInput {
  rootSymbolId: string;
  nodes: SerializedCallNode[];
  edges: SerializedCallEdge[];
}

const CALL_GRAPH_KINDS: Record<SerializedCallEdge["typeRelation"], StructureRelationKind> = {
  CALLS: "CALLS",
  INHERITS: "INHERITS",
  IMPLEMENTS: "IMPLEMENTS",
  USES: "USES",
};

/**
 * Call graph → model. `@@external:` targets are kept as unresolved relations
 * with their name: the analyzer saw a reference but cannot identify the symbol.
 */
export function callGraphToModel(input: CallGraphInput): {
  nodes: StructureNode[];
  relations: StructureRelation[];
  issues: StructureIssue[];
} {
  const nodes: StructureNode[] = input.nodes.map((node) => ({
    id: node.id,
    kind: "symbol",
    name: node.name,
    language: node.lang,
    path: normalizePath(node.path),
    range: { startLine: node.startLine + 1, endLine: node.endLine + 1 },
    parentId: normalizePath(node.path),
    exported: node.isExported,
  }));

  const pathById = new Map(input.nodes.map((node) => [node.id, normalizePath(node.path)]));
  const issues: StructureIssue[] = [];
  const relations: StructureRelation[] = input.edges.map((edge) => {
    const unresolved = edge.targetId.startsWith("@@external:");
    const targetName = unresolved
      ? edge.targetId.slice("@@external:".length).split("@")[0]
      : undefined;
    const location = {
      path: pathById.get(edge.sourceId) ?? edge.sourceId,
      line: edge.sourceLine + 1,
    };
    if (unresolved) {
      issues.push({
        kind: "unresolved-call",
        message: `Unresolved ${edge.typeRelation.toLowerCase()} target: ${targetName}`,
        location,
      });
    }
    return {
      id: relationId(CALL_GRAPH_KINDS[edge.typeRelation], edge.sourceId, edge.targetId),
      kind: CALL_GRAPH_KINDS[edge.typeRelation],
      sourceId: edge.sourceId,
      ...(unresolved ? { targetName } : { targetId: edge.targetId }),
      locations: [location],
      evidence: "syntax" as const,
      certainty: unresolved ? ("unresolved" as const) : ("confirmed" as const),
    };
  });

  return { nodes, relations, issues };
}
