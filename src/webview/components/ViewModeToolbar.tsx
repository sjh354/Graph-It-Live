/**
 * ViewModeToolbar — the mode switch shown at the top of the editor tab.
 *
 * The sidebar keeps its icons in the view title; the editor tab had no control
 * at all, so switching modes required the command palette (DESIGN 3.1).
 *
 * NO @/ path aliases — webview uses relative imports.
 */

import React from "react";

export type ToolbarMode = "file" | "list" | "symbol" | "architecture" | "callgraph";

interface ViewModeToolbarProps {
  mode: string;
  onSelect: (mode: ToolbarMode) => void;
}

const MODES: ReadonlyArray<{ mode: ToolbarMode; label: string; title: string }> = [
  { mode: "file", label: "Graph", title: "File dependency graph" },
  { mode: "list", label: "List", title: "Dependencies of the current file as a list" },
  { mode: "symbol", label: "Symbols", title: "Symbols inside the current file" },
  { mode: "architecture", label: "Architecture", title: "Workspace units, roles and rules" },
  { mode: "callgraph", label: "Call graph", title: "Calls around the symbol under the cursor" },
];

const baseButton: React.CSSProperties = {
  border: "none",
  borderRadius: 3,
  padding: "4px 10px",
  fontSize: 11,
  cursor: "pointer",
  background: "transparent",
  color: "var(--vscode-foreground, #ccc)",
  whiteSpace: "nowrap",
};

export function ViewModeToolbar({ mode, onSelect }: Readonly<ViewModeToolbarProps>): React.ReactElement {
  return (
    <div
      role="toolbar"
      aria-label="Graph view mode"
      data-testid="view-mode-toolbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flex: "0 0 auto",
        height: 34,
        padding: "0 6px",
        borderBottom: "1px solid var(--vscode-panel-border, rgba(128,128,128,0.35))",
        background: "var(--vscode-editor-background)",
      }}
    >
      {MODES.map((entry) => {
        const active = mode === entry.mode;
        return (
          <button
            key={entry.mode}
            type="button"
            title={entry.title}
            aria-pressed={active}
            onClick={() => onSelect(entry.mode)}
            style={{
              ...baseButton,
              background: active ? "var(--vscode-button-background)" : "transparent",
              color: active
                ? "var(--vscode-button-foreground)"
                : "var(--vscode-foreground, #ccc)",
              fontWeight: active ? 600 : 400,
            }}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}
