/**
 * Position planning for live refreshes of the call graph.
 *
 * DESIGN 3.2: a save, a filter or a partial expansion must not re-randomise the
 * whole layout. Existing nodes keep their position (and with it the user's
 * mental map); new nodes are placed around the neighbours that are already
 * positioned. Only an explicit re-layout or a new root rebuilds the layout.
 *
 * NO @/ path aliases — webview uses relative imports.
 */

export interface Point {
  x: number;
  y: number;
}

export type PositionMap = ReadonlyMap<string, Point>;

/** Symbol IDs embed the start line, which a save can change: also remember path+name. */
export function aliasKey(path: string, name: string): string {
  return `${path}\u0000${name}`;
}

/** Distance between a new node and the average position of its neighbours. */
const NEW_NODE_RADIUS = 70;

/** Golden angle spreads the offsets of several new nodes around the same cluster. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface PositionableNode {
  id: string;
  path: string;
  name: string;
}

interface PositionableEdge {
  sourceId: string;
  targetId: string;
}

/**
 * Positions for `nodes`, preferring the saved position of the same symbol.
 *
 * A node with no saved position is placed beside its already-positioned
 * neighbours; one with no positioned neighbour falls back to a deterministic
 * ring around the origin so the result never depends on iteration order.
 */
export function planPositions(
  saved: PositionMap,
  nodes: ReadonlyArray<PositionableNode>,
  edges: ReadonlyArray<PositionableEdge>,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  const pending: PositionableNode[] = [];

  for (const node of nodes) {
    const previous = saved.get(node.id) ?? saved.get(aliasKey(node.path, node.name));
    if (previous) {
      positions.set(node.id, { ...previous });
    } else {
      pending.push(node);
    }
  }

  const neighbours = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    const set = neighbours.get(a) ?? new Set<string>();
    set.add(b);
    neighbours.set(a, set);
  };
  for (const edge of edges) {
    link(edge.sourceId, edge.targetId);
    link(edge.targetId, edge.sourceId);
  }

  // Repeated passes so a chain of new nodes grows outwards from a positioned one.
  for (let pass = 0; pass < pending.length && pending.length > 0; pass++) {
    let placedAny = false;
    for (let index = pending.length - 1; index >= 0; index--) {
      const node = pending[index];
      const anchors = [...(neighbours.get(node.id) ?? [])]
        .map((id) => positions.get(id))
        .filter((point): point is Point => point !== undefined);
      if (anchors.length === 0) continue;

      const centre = anchors.reduce(
        (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      );
      const angle = index * GOLDEN_ANGLE;
      positions.set(node.id, {
        x: centre.x / anchors.length + Math.cos(angle) * NEW_NODE_RADIUS,
        y: centre.y / anchors.length + Math.sin(angle) * NEW_NODE_RADIUS,
      });
      pending.splice(index, 1);
      placedAny = true;
    }
    if (!placedAny) break;
  }

  // Disconnected new nodes: a deterministic ring around the origin.
  for (let index = 0; index < pending.length; index++) {
    const angle = index * GOLDEN_ANGLE;
    const radius = NEW_NODE_RADIUS * (1 + index / 8);
    positions.set(pending[index].id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return positions;
}
