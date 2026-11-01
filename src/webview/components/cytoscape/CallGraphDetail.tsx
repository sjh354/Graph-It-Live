/**
 * CallGraphDetail — the right-hand panel of the call graph.
 *
 * A click on a symbol circle selects it and shows its details here; it does not
 * open code and does not re-centre the graph (DESIGN 3.2). Those are explicit
 * buttons. An edge click shows the relation and its call site instead.
 *
 * NO @/ path aliases — webview uses relative imports.
 */

import React from "react";
import type {
  SerializedCallEdge,
  SerializedCallNode,
} from "../../../shared/callgraph-types";

export interface CallGraphDetailProps {
  nodes: SerializedCallNode[];
  edges: SerializedCallEdge[];
  selectedNodeId?: string;
  selectedEdgeId?: string;
  rootSymbolId: string;
  projectName?: string;
  /** Unix ms of the analysis the shown graph came from */
  generatedAt?: number;
  onOpenFile: (path: string, line: number, column: number) => void;
  onFocusNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onCopy: (text: string) => void;
  onClose: () => void;
}

/** Edge key used by the graph and by `selectedEdgeId`. */
export function callEdgeId(edge: SerializedCallEdge): string {
  return `${edge.sourceId}→${edge.targetId}→${edge.typeRelation}`;
}

const shortPath = (path: string): string => {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join("/");
};

export interface ReferenceTextInput {
  projectName?: string;
  node: SerializedCallNode;
  rootSymbolId: string;
  generatedAt?: number;
}

/**
 * The copyable reference from DESIGN 3.2: project, node id, path, symbol,
 * position and the version of the analysis it was read from.
 */
export function buildReferenceText({
  projectName,
  node,
  rootSymbolId,
  generatedAt,
}: ReferenceTextInput): string {
  const analysis = generatedAt ? new Date(generatedAt).toISOString() : "unknown";
  return [
    `project: ${projectName ?? "unknown"}`,
    `node: ${node.id}`,
    `symbol: ${node.name} (${node.type}, ${node.lang})${node.isExported ? " exported" : ""}`,
    `path: ${node.path}`,
    `position: ${node.startLine + 1}:${node.startCol + 1}-${node.endLine + 1}`,
    `root: ${rootSymbolId}`,
    `analysis: ${analysis}`,
  ].join("\n");
}

const panelStyle: React.CSSProperties = {
  width: 280,
  flex: "0 0 280px",
  height: "100%",
  overflowY: "auto",
  borderLeft: "1px solid var(--vscode-panel-border, rgba(128,128,128,0.35))",
  background: "var(--vscode-sideBar-background, var(--vscode-editor-background))",
  color: "var(--vscode-foreground, #ccc)",
  fontSize: 12,
  padding: "10px 12px 16px",
  boxSizing: "border-box",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "14px 0 6px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--vscode-descriptionForeground, #888)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  padding: "3px 0",
  lineHeight: 1.4,
};

const chipStyle: React.CSSProperties = {
  borderRadius: 3,
  padding: "0 5px",
  fontSize: 10,
  lineHeight: "16px",
  background: "var(--vscode-badge-background, #4d4d4d)",
  color: "var(--vscode-badge-foreground, #fff)",
  whiteSpace: "nowrap",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--vscode-button-secondaryBackground, #3a3d41)",
  color: "var(--vscode-button-secondaryForeground, #fff)",
  border: "none",
  borderRadius: 3,
  padding: "5px 8px",
  fontSize: 11,
  cursor: "pointer",
};

function RelationRow({
  edge,
  other,
  onOpenFile,
  onSelectEdge,
}: Readonly<{
  edge: SerializedCallEdge;
  other: SerializedCallNode | undefined;
  onOpenFile: (path: string, line: number, column: number) => void;
  onSelectEdge: (edgeId: string) => void;
}>): React.ReactElement {
  const relation = edge.typeRelation === "CALLS" ? "calls" : edge.typeRelation.toLowerCase();
  return (
    <div style={rowStyle} data-testid="relation-row">
      <button
        type="button"
        onClick={() => onSelectEdge(callEdgeId(edge))}
        title="Show this relation's call site"
        style={{
          ...buttonStyle,
          padding: "2px 5px",
          background: "transparent",
          color: "var(--vscode-textLink-foreground, #3794ff)",
          textAlign: "left",
          flex: 1,
        }}
      >
        <span style={{ color: "var(--vscode-foreground, #ccc)" }}>{relation} </span>
        {other?.name ?? "?"}
      </button>
      {edge.isCyclic && <span style={chipStyle}>cycle</span>}
      <button
        type="button"
        onClick={() => onOpenFile(other?.path ?? edge.sourceId, edge.sourceLine, 0)}
        title={`Open line ${edge.sourceLine + 1}`}
        style={{ ...buttonStyle, padding: "2px 6px" }}
      >
        :{edge.sourceLine + 1}
      </button>
    </div>
  );
}

/** The detail for one symbol or one selected relation. */
export function CallGraphDetail(props: Readonly<CallGraphDetailProps>): React.ReactElement | null {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    rootSymbolId,
    projectName,
    generatedAt,
    onOpenFile,
    onFocusNode,
    onSelectEdge,
    onCopy,
    onClose,
  } = props;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const node = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  const edge = !node && selectedEdgeId
    ? edges.find((candidate) => callEdgeId(candidate) === selectedEdgeId)
    : undefined;

  if (!node && !edge) return null;

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      title="Close details"
      aria-label="Close details"
      style={{ ...buttonStyle, padding: "2px 7px", marginLeft: "auto" }}
    >
      ✕
    </button>
  );

  if (edge) {
    const source = nodeById.get(edge.sourceId);
    const target = nodeById.get(edge.targetId);
    const direction =
      edge.sourceId === rootSymbolId
        ? "outgoing from the root"
        : edge.targetId === rootSymbolId
          ? "incoming to the root"
          : "lateral";
    return (
      <aside style={panelStyle} data-testid="call-graph-detail">
        <div style={{ display: "flex", alignItems: "center" }}>
          <strong>Relation</strong>
          {closeButton}
        </div>
        <div style={sectionTitleStyle}>Call site</div>
        <div style={rowStyle}>
          <span style={chipStyle}>{edge.typeRelation}</span>
          <span>{`${source?.name ?? "?"} → ${target?.name ?? "?"}`}</span>
        </div>
        <div style={{ ...rowStyle, color: "var(--vscode-descriptionForeground, #888)" }}>
          {direction}
          {edge.isCyclic ? " · cycle" : ""}
        </div>
        <button
          type="button"
          style={{ ...buttonStyle, marginTop: 8 }}
          onClick={() => onOpenFile(source?.path ?? edge.sourceId, edge.sourceLine, 0)}
        >
          Open line {edge.sourceLine + 1}
        </button>
        <div style={sectionTitleStyle}>Location</div>
        <div style={{ wordBreak: "break-all", color: "var(--vscode-descriptionForeground, #888)" }}>
          {shortPath(source?.path ?? edge.sourceId)}:{edge.sourceLine + 1}
        </div>
      </aside>
    );
  }

  if (!node) return null;

  const outgoing = edges.filter((candidate) => candidate.sourceId === node.id);
  const incoming = edges.filter((candidate) => candidate.targetId === node.id);

  return (
    <aside style={panelStyle} data-testid="call-graph-detail">
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <strong style={{ fontSize: 13, wordBreak: "break-all" }}>{node.name}</strong>
        {node.isRoot && <span style={chipStyle}>root</span>}
        {closeButton}
      </div>

      <div style={{ ...rowStyle, color: "var(--vscode-descriptionForeground, #888)" }}>
        <span>{node.type}</span>
        <span>·</span>
        <span>{node.lang}</span>
        {node.isExported && (
          <>
            <span>·</span>
            <span>exported</span>
          </>
        )}
      </div>

      <div style={{ ...rowStyle, wordBreak: "break-all" }} title={node.path}>
        {shortPath(node.path)}:{node.startLine + 1}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => onOpenFile(node.path, node.startLine, node.startCol)}
        >
          Open code
        </button>
        {!node.isRoot && (
          <button
            type="button"
            style={buttonStyle}
            onClick={() => onFocusNode(node.id)}
            title="Query this symbol's neighbourhood and re-centre the graph"
          >
            Centre on symbol
          </button>
        )}
        <button
          type="button"
          style={buttonStyle}
          onClick={() =>
            onCopy(buildReferenceText({ projectName, node, rootSymbolId, generatedAt }))
          }
          title="Copy project, node id, path, symbol, position and analysis version"
        >
          Copy reference
        </button>
      </div>

      <div style={sectionTitleStyle}>Calls out ({outgoing.length})</div>
      {outgoing.length === 0 && <div style={{ opacity: 0.6 }}>None</div>}
      {outgoing.map((candidate) => (
        <RelationRow
          key={callEdgeId(candidate)}
          edge={candidate}
          other={nodeById.get(candidate.targetId)}
          onOpenFile={onOpenFile}
          onSelectEdge={onSelectEdge}
        />
      ))}

      <div style={sectionTitleStyle}>Called by ({incoming.length})</div>
      {incoming.length === 0 && <div style={{ opacity: 0.6 }}>None</div>}
      {incoming.map((candidate) => (
        <RelationRow
          key={callEdgeId(candidate)}
          edge={candidate}
          other={nodeById.get(candidate.sourceId)}
          onOpenFile={onOpenFile}
          onSelectEdge={onSelectEdge}
        />
      ))}
    </aside>
  );
}
