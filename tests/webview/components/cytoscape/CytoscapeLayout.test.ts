import { describe, expect, it } from "vitest";
import { aliasKey, planPositions } from "@/webview/components/cytoscape/CytoscapeLayout";

const node = (id: string, name = id) => ({ id, path: `/workspace/${name}.ts`, name });
const edge = (sourceId: string, targetId: string) => ({ sourceId, targetId });

describe("planPositions", () => {
  it("keeps a saved position by id", () => {
    const saved = new Map([["a", { x: 10, y: 20 }]]);

    const positions = planPositions(saved, [node("a")], []);

    expect(positions.get("a")).toEqual({ x: 10, y: 20 });
  });

  it("keeps a saved position when the start line changed the id", () => {
    const saved = new Map([[aliasKey("/workspace/a.ts", "a"), { x: 5, y: 6 }]]);

    const positions = planPositions(saved, [node("a:12", "a")], []);

    expect(positions.get("a:12")).toEqual({ x: 5, y: 6 });
  });

  it("places a new symbol beside an already positioned neighbour", () => {
    const saved = new Map([["a", { x: 100, y: 100 }]]);

    const positions = planPositions(saved, [node("a"), node("b")], [edge("a", "b")]);
    const placed = positions.get("b")!;

    const distance = Math.hypot(placed.x - 100, placed.y - 100);
    expect(distance).toBeGreaterThan(60);
    expect(distance).toBeLessThan(80);
  });

  it("grows a chain of new symbols outwards from the positioned one", () => {
    const saved = new Map([["a", { x: 0, y: 0 }]]);
    const nodes = [node("a"), node("b"), node("c")];
    const edges = [edge("a", "b"), edge("b", "c")];

    const positions = planPositions(saved, nodes, edges);

    expect([...positions.keys()].sort()).toEqual(["a", "b", "c"]);
    expect(Math.hypot(positions.get("b")!.x, positions.get("b")!.y)).toBeGreaterThan(60);
    expect(Math.hypot(positions.get("c")!.x, positions.get("c")!.y)).toBeGreaterThan(60);
  });

  it("puts disconnected new symbols on a deterministic ring", () => {
    const positions = planPositions(new Map(), [node("a"), node("b")], []);

    expect(positions.get("a")).not.toEqual(positions.get("b"));
    // Same input, same result: a refresh must not shuffle the graph.
    expect(planPositions(new Map(), [node("a"), node("b")], [])).toEqual(positions);
  });
});
