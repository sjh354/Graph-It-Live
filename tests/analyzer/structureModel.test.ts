import { describe, expect, it } from "vitest";
import type { SerializedCallEdge, SerializedCallNode } from "@/shared/callgraph-types";
import {
  callGraphToModel,
  createStructureModel,
  fileGraphToModel,
  STRUCTURE_MODEL_VERSION,
  symbolGraphToModel,
} from "@/analyzer/model/structureModel";
import { capabilitiesFor, languageForPath, unsupportedFeatures } from "@/analyzer/model/languageCapabilities";

const scope = {
  root: "/workspace",
  languages: ["typescript"],
  excluded: ["node_modules"],
  unsupported: [],
};

describe("fileGraphToModel", () => {
  it("keeps file imports apart from symbol calls", () => {
    const { nodes, relations } = fileGraphToModel(
      {
        filePath: "/workspace/src/a.ts",
        nodes: ["/workspace/src/a.ts", "/workspace/src/b.ts"],
        edges: [{ source: "/workspace/src/a.ts", target: "/workspace/src/b.ts", sourceLine: 3 }],
      },
      "typescript",
    );

    expect(nodes.every((node) => node.kind === "file")).toBe(true);
    expect(relations).toEqual([
      expect.objectContaining({
        kind: "IMPORTS",
        sourceId: "/workspace/src/a.ts",
        targetId: "/workspace/src/b.ts",
        locations: [{ path: "/workspace/src/a.ts", line: 3 }],
        evidence: "syntax",
        certainty: "confirmed",
      }),
    ]);
  });
});

describe("symbolGraphToModel", () => {
  it("links a call to the declared symbol id, not to its name", () => {
    const { relations } = symbolGraphToModel(
      {
        filePath: "/workspace/src/a.ts",
        symbols: [
          { id: "/workspace/src/a.ts:run", name: "run", kind: "Function", line: 1, isExported: true },
          { id: "/workspace/src/a.ts:helper", name: "helper", kind: "Function", line: 5, isExported: true },
        ],
        dependencies: [
          {
            sourceSymbolId: "/workspace/src/a.ts:run",
            targetSymbolId: "/workspace/src/a.ts:helper",
            targetFilePath: "/workspace/src/a.ts",
            line: 2,
          },
        ],
      },
      "typescript",
    );

    expect(relations[0]).toMatchObject({
      kind: "CALLS",
      sourceId: "/workspace/src/a.ts:run",
      targetId: "/workspace/src/a.ts:helper",
      locations: [{ path: "/workspace/src/a.ts", line: 2 }],
    });
  });

  it("records syntactic evidence as estimated instead of confirmed semantics", () => {
    const { relations } = symbolGraphToModel(
      {
        filePath: "/workspace/lib/home.dart",
        symbols: [{ id: "/workspace/lib/home.dart:main", name: "main", kind: "Function", line: 1 }],
        dependencies: [
          {
            sourceSymbolId: "/workspace/lib/home.dart:main",
            targetSymbolId: "/workspace/lib/home.dart:helper",
            targetFilePath: "/workspace/lib/home.dart",
            line: 4,
          },
        ],
      },
      "dart",
      { evidence: "syntax", certainty: "estimated" },
    );

    expect(relations[0]).toMatchObject({ evidence: "syntax", certainty: "estimated" });
  });
});

const node = (overrides: Partial<SerializedCallNode>): SerializedCallNode => ({
  id: "/workspace/src/a.ts:run:1",
  name: "run",
  type: "function",
  lang: "typescript",
  path: "/workspace/src/a.ts",
  folder: "src",
  startLine: 0,
  endLine: 4,
  startCol: 0,
  isExported: true,
  isRoot: true,
  ...overrides,
});

const edge = (overrides: Partial<SerializedCallEdge>): SerializedCallEdge => ({
  sourceId: "/workspace/src/a.ts:run:1",
  targetId: "/workspace/src/a.ts:helper:5",
  typeRelation: "CALLS",
  isCyclic: false,
  sourceLine: 2,
  direction: "outgoing",
  ...overrides,
});

describe("callGraphToModel", () => {
  const helper = node({
    id: "/workspace/src/a.ts:helper:5",
    name: "helper",
    startLine: 5,
    endLine: 8,
    isRoot: false,
  });

  it("marks an unresolved external target as unresolved instead of inventing an id", () => {
    const model = callGraphToModel({
      rootSymbolId: "/workspace/src/a.ts:run:1",
      nodes: [node({}), helper],
      edges: [edge({ targetId: "@@external:printf" })],
    });

    expect(model.relations[0]).toMatchObject({
      kind: "CALLS",
      targetName: "printf",
      certainty: "unresolved",
      locations: [{ path: "/workspace/src/a.ts", line: 3 }],
    });
    expect(model.relations[0].targetId).toBeUndefined();
    expect(model.issues[0]).toMatchObject({ kind: "unresolved-call" });
  });

  it("keeps a resolved call confirmed and converts both ends", () => {
    const model = callGraphToModel({
      rootSymbolId: "/workspace/src/a.ts:run:1",
      nodes: [node({}), helper],
      edges: [edge({})],
    });

    expect(model.nodes.map((candidate) => candidate.id)).toEqual([node({}).id, helper.id]);
    expect(model.relations[0]).toMatchObject({ targetId: helper.id, certainty: "confirmed" });
    expect(model.issues).toEqual([]);
  });

  it("maps inheritance separately from calls", () => {
    const model = callGraphToModel({
      rootSymbolId: "/workspace/src/a.ts:run:1",
      nodes: [node({}), helper],
      edges: [edge({ typeRelation: "INHERITS" })],
    });

    expect(model.relations[0].kind).toBe("INHERITS");
  });
});

describe("createStructureModel", () => {
  it("de-duplicates nodes and relations that the adapters produced twice", () => {
    const nodeA = { id: "a", kind: "file" as const, name: "a", language: "typescript", path: "/a" };
    const relation = {
      id: "IMPORTS:a->b",
      kind: "IMPORTS" as const,
      sourceId: "a",
      targetId: "b",
      locations: [],
      evidence: "syntax" as const,
      certainty: "confirmed" as const,
    };

    const model = createStructureModel(scope, [nodeA, nodeA], [relation, relation]);

    expect(model.schemaVersion).toBe(STRUCTURE_MODEL_VERSION);
    expect(model.nodes).toHaveLength(1);
    expect(model.relations).toHaveLength(1);
  });
});

describe("languageCapabilities", () => {
  it("claims file imports and symbols for Dart but not the cross-file call graph", () => {
    expect(languageForPath("/workspace/lib/main.dart")).toBe("dart");
    expect(capabilitiesFor("/workspace/lib/main.dart")).toMatchObject({
      fileImports: true,
      symbols: true,
      intraFileCalls: true,
      crossFileCalls: false,
    });
  });

  it("claims nothing for an unknown extension and reports the gaps", () => {
    expect(capabilitiesFor("/workspace/README.md")).toMatchObject({
      fileImports: false,
      symbols: false,
      crossFileCalls: false,
    });
    expect(unsupportedFeatures("/workspace/README.md")).toContain("file imports");
  });

  it("claims the full pipeline for the tree-sitter languages", () => {
    expect(unsupportedFeatures("/workspace/src/a.ts")).toEqual([]);
    expect(unsupportedFeatures("/workspace/lib/home.dart")).toContain("cross-file call graph");
  });
});
