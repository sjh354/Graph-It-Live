import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { SpiderBuilder } from "@/analyzer/SpiderBuilder";
import type { Spider } from "@/analyzer/Spider";
import { normalizePath } from "@/shared/path";

const fixtures = path.resolve(process.cwd(), "tests/dart-fixture");

describe("Spider - Dart integration", () => {
  let spider: Spider;

  beforeEach(() => {
    spider = new SpiderBuilder()
      .withRootDir(fixtures)
      .withMaxDepth(10)
      .withExcludeNodeModules(true)
      .withExtensionPath(process.cwd())
      .build();
  });

  it("crawls Dart relative and package imports", async () => {
    const mainFile = path.join(fixtures, "lib/main.dart");
    const result = await spider.crawl(mainFile);

    const app = normalizePath(path.join(fixtures, "lib/app.dart"));
    const util = normalizePath(path.join(fixtures, "lib/util.dart"));
    expect(result.nodes).toContain(app);
    expect(result.nodes).toContain(util);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: normalizePath(mainFile), target: app }),
        expect.objectContaining({ source: app, target: util }),
      ]),
    );
  });

  it("returns Dart declarations and intra-file calls for the symbol view", async () => {
    const appFile = path.join(fixtures, "lib/app.dart");
    const { symbols, dependencies } = await spider.getSymbolGraph(appFile);
    const byName = new Map(symbols.map((symbol) => [symbol.name, symbol]));

    expect([...byName.keys()]).toEqual(expect.arrayContaining(["App", "start", "helper", "unusedHelper"]));
    expect(byName.get("App")).toMatchObject({ category: "class" });
    expect(dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceSymbolId: `${normalizePath(appFile)}:App.unusedHelper`,
          targetSymbolId: `${normalizePath(appFile)}:App.helper`,
        }),
      ]),
    );
  });

  it("does not attach a Dart file to a TypeScript symbol analyzer", async () => {
    const appFile = path.join(fixtures, "lib/app.dart");
    const { symbols } = await spider.getSymbolGraph(appFile);

    // The ts-morph AST worker would report TS-shaped symbols here.
    expect(symbols.every((symbol) => !symbol.kind.includes("Interface"))).toBe(true);
    expect(symbols.some((symbol) => symbol.name === "app.dart")).toBe(false);
  });
});
