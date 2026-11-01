import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractDart } from "@/analyzer/callgraph/dartCallGraphExtractor";
import { CallGraphIndexer } from "@/analyzer/callgraph/CallGraphIndexer";
import { fileExtToLang, GraphExtractor } from "@/analyzer/callgraph/GraphExtractor";
import { normalizePath } from "@/shared/path";

const FILE = "/ws/lib/home.dart";
const SQL_WASM = path.resolve("node_modules/sql.js/dist/sql-wasm.wasm");

/** Edges as "Source -REL-> Target"; unresolved stubs shown as `@Name`. */
function edgesOf(source: string): string[] {
  const { nodes, edges } = extractDart(source, FILE, "lib");
  const name = new Map(nodes.map((node) => [node.id, node.name]));
  return edges
    .map((edge) => `${name.get(edge.sourceId) ?? edge.sourceId} -${edge.typeRelation}-> ${name.get(edge.targetId) ?? edge.targetId.replace("@@external:", "@")}`)
    .sort();
}

describe("extractDart", () => {
  it("makes declarations nodes without a duplicate constructor", () => {
    const source = [
      "class HomePage extends StatefulWidget {",
      "  const HomePage({super.key});",
      "  void _load() {}",
      "}",
      "",
      "String format(String value) => value;",
    ].join("\n");

    const { nodes } = extractDart(source, FILE, "lib");

    expect(nodes.map((node) => `${node.type}:${node.name}`).sort()).toEqual([
      "class:HomePage",
      "function:format",
      "method:_load",
    ]);
    expect(nodes.every((node) => node.lang === "dart" && node.path === FILE)).toBe(true);
    expect(nodes.find((node) => node.name === "HomePage")?.startLine).toBe(0);
  });

  it("links same-file calls and keeps unknown calls as external stubs", () => {
    const source = [
      "class App {",
      "  void start() {",
      "    helper();",
      "    computeTotal();",
      "  }",
      "  void helper() {}",
      "}",
    ].join("\n");

    expect(edgesOf(source)).toEqual([
      "start -CALLS-> @computeTotal",
      "start -CALLS-> helper",
    ]);
  });

  it("reads supertype clauses as inheritance, mixin and interface edges", () => {
    const source = [
      "mixin Logging on Base {",
      "  void log() {}",
      "}",
      "class Model extends Base with Logging implements Comparable, Disposable {",
      "}",
    ].join("\n");

    const edges = edgesOf(source);

    expect(edges).toEqual(
      expect.arrayContaining([
        "Model -INHERITS-> @Base",
        "Model -INHERITS-> Logging",
        "Model -IMPLEMENTS-> @Comparable",
        "Model -IMPLEMENTS-> @Disposable",
        "Logging -USES-> @Base",
      ]),
    );
  });

  it("attributes calls to the innermost declaration, not the class", () => {
    const source = [
      "class A {",
      "  void first() { one(); }",
      "  void second() { two(); }",
      "  void one() {}",
      "  void two() {}",
      "}",
    ].join("\n");

    const edges = edgesOf(source);

    expect(edges).toContain("first -CALLS-> one");
    expect(edges).toContain("second -CALLS-> two");
    expect(edges).not.toContain("A -CALLS-> one");
  });
});

describe("Dart in the shared extractor pipeline", () => {
  it("maps .dart to the dart language", () => {
    expect(fileExtToLang("/ws/lib/main.dart")).toBe("dart");
  });

  it("resolves a cross-file Dart call by name through the indexer", async () => {
    const extractor = new GraphExtractor({ extensionPath: process.cwd(), workspaceRoot: "/ws" });
    const indexer = new CallGraphIndexer(SQL_WASM);
    await indexer.init();
    const files: Record<string, string> = {
      "lib/util.dart": "String format(String value) => value.trim();",
      "lib/app.dart": "import 'util.dart';\n\nvoid run() {\n  format('x');\n}\n",
    };
    for (const [relative, source] of Object.entries(files)) {
      const file = normalizePath(`/ws/${relative}`);
      const lang = fileExtToLang(file);
      if (!lang) throw new Error(`missing lang for ${file}`);
      const result = await extractor.extractSource(file, lang, source);
      indexer.indexFile(result.nodes, result.edges, file, lang, 1);
    }
    indexer.resolveExternalEdges();
    extractor.dispose();

    const snapshot = indexer.getIndexSnapshot();
    indexer.dispose();
    const label = new Map(snapshot.nodes.map((node) => [node.id, `${path.basename(node.path)}#${node.name}`]));

    expect(snapshot.edges.map((edge) => `${label.get(edge.sourceId)} -${edge.typeRelation}-> ${label.get(edge.targetId)}`)).toEqual([
      "app.dart#run -CALLS-> util.dart#format",
    ]);
  });
});
