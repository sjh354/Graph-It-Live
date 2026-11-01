# Structure Graph

**See your codebase as a graph — in VS Code and your AI assistant.**

Structure Graph analyzes imports, symbols, calls, cycles, unused exports, and change impact. Use it as a VS Code extension or an MCP/native tool provider for GitHub Copilot and other AI clients. Analysis runs locally and returns evidence from your codebase.

## Table of Contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Features](#features)
- [AI integrations](#ai-integrations)
- [Configuration](#configuration)
- [Supported languages](#supported-languages)
- [Documentation](#documentation)
- [Development](#development)
- [License](#license)

## What it does

Structure Graph provides three views of a codebase:

| View | Answers | Analysis layer |
| --- | --- | --- |
| **File graph** | Which files import this file? What depends on this module? | Regex and AST parsing |
| **Symbol view** | Which functions and classes call each other in this file? | AST analysis |
| **Live call graph** | Which symbols call each other across files? | Tree-sitter and SQLite |

Use the same graph data to navigate code, review refactors, generate codemaps, and give AI assistants focused context instead of entire source files.

## Quick start

### VS Code extension

**Requirements:** VS Code 1.96 or later. This is a local fork: run `npm install && npm run build`, then press **F5** to launch the Extension Development Host, or run `npm run package` and install the generated VSIX.

1. Open a project.
2. Run **Structure Graph: Show Dependency Graph** from the Command Palette; the view opens in the bottom panel.
3. Click a file to open it, double-click it for the Symbol View, or use **Show Call Graph** for cross-file calls.

Supported projects include TypeScript, JavaScript, Python, Rust, C#, Go, Java, Vue, Svelte, and GraphQL.

### First useful actions

| Goal | Action |
| --- | --- |
| Explore imports | Open the dependency graph and expand a file node |
| Inspect functions | Switch to **Symbol View** or double-click a file |
| Find callers | Open **Show Call Graph** with a symbol selected |
| Find reverse dependencies | Use **Show Reverse Dependencies** |
| Hide unused imports | Enable **Filter Unused Dependencies** |
| Refresh analysis | Run **Refresh Graph** or **Force Structure Graph re-index** |

## Features

### File dependency graph

- Visualize file-to-file imports across a workspace.
- Detect circular dependencies and highlight cycles.
- Expand and collapse nodes as you explore.
- Open files directly from graph nodes.
- Find reverse dependencies with an indexed lookup.

### Symbol View

Drill into TypeScript, JavaScript, Python, or Rust files to see functions, classes, variables, outgoing calls, incoming callers, and recursive calls. Click a symbol to navigate to its definition.

### Live Call Graph

The Live Call Graph shows cross-file symbol relationships in a Cytoscape.js panel.

- Expand callers and callees with a depth from 1 to 5. A view shows at most 500 symbols, nearest hops first; a notice counts the hidden ones.
- Group symbols by folder.
- Number calls in invocation order.
- Highlight self-recursion and mutual recursion.
- Filter by symbol type or folder.
- Refresh automatically after file saves.

The Live Call Graph supports TypeScript, JavaScript, Vue, Svelte, Python, Rust, C#, Go, Java, and GraphQL. C#, Go, Java, and GraphQL are supported in the file graph and Live Call Graph; Symbol View support is currently limited to TypeScript, JavaScript, Python, and Rust. In GraphQL, operations and fragments call the fragments they spread; an operation's default root type (`Query`, `Mutation`, `Subscription`), type conditions, field, argument and variable types, and union members are type-only references (`USES`, shown with `includeTypeOnly`); `implements` is an `IMPLEMENTS` edge.

### Architecture view

The Architecture view draws the whole workspace as **units** (packages, else top-level folders) in layers, with the import edges between them, their roles and their cycles. It answers three questions: what are my layers, who depends on this, and does the code follow my rules. The [architecture guide](docs/architecture.md) defines every term, explains the marks of each view and how to fix what they raise: cycles, rule violations, unmatched files.

Quick start:

1. Open the *Dependency Graph* view and click *Switch to Architecture View* (icon `$(type-hierarchy)`).
2. Double-click a unit to enter its folders; *Escape* goes back.
3. Click an edge to list the file pairs behind it.
4. Select a node, then *Dependents by group* to see every group that imports it.
5. Click *Matrix* for the dependency structure matrix of the level.

The Architecture view and the MCP tool `explore_architecture` report the same counts.

### Architecture rules

Declare your intended architecture in `graphit.architecture.json` at the workspace root: `elements` name sets of files, `rules` say what each may import, and `roles` declare what each unit is. The view lists each rule with its violations; the `check_architecture` MCP tool reports new `error` violations, supports a baseline for existing code, and can gate CI. See [the config file](docs/architecture.md#the-config-file) for a complete example.

### Unused dependencies and impact analysis

- Hide or dim unused dependencies.
- Detect unused exported symbols.
- Trace execution from a function or symbol.
- Identify callers affected by a signature change.
- Generate a codemap with exports, internals, dependencies, dependents, and call flow.

## AI integrations

Structure Graph exposes local graph analysis to GitHub Copilot, Claude, Cursor, Windsurf, Antigravity, and other MCP-compatible clients.

### Native Copilot tools

When the extension is installed, use these tools in Copilot Agent mode without configuring MCP:

| Tool group | Capabilities |
| --- | --- |
| Navigation | Dependencies, reverse dependencies, imports, module resolution, workspace index status |
| Symbols | Symbol graphs, callers, dependents, execution traces |
| Refactoring | Breaking changes, impact analysis, unused symbols, dead-code scans |
| Context | File logic, codemaps, unified graph context, natural-language graph queries |
| Call graph | Cross-file caller/callee queries and neighbourhood expansion |

The graph-context tool is available as `#graphContext`. Other native references include `#graphDeps`, `#graphFindRefs`, `#graphCallers`, `#graphImpact`, `#graphCodemap`, `#graphTrace`, `#graphDeadCode`, and `#graphQuery`.

### MCP server

The MCP server exposes 22 graph-analysis tools. Enable it in VS Code with `graph-it-live.enableMcpServer`, or point a client at the built bundle with `node <extension>/dist/mcpServer.mjs`.

For VS Code, add `.vscode/mcp.json`:

```json
{
  "servers": {
    "graph-it-live": {
      "type": "stdio",
      "command": "node",
      "args": ["<extension>/dist/mcpServer.mjs"],
      "env": {
        "WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

For Cursor, use `.cursor/mcp.json` with the same server definition under `mcpServers` instead of `servers`. The same `node <extension>/dist/mcpServer.mjs` command works with Claude Desktop, Claude Code, Windsurf, and Antigravity; each client reads its own configuration file and environment variables.

For Codex CLI:

```bash
codex mcp add graph-it-live --env WORKSPACE_ROOT=/path/to/project -- node /path/to/graph-it-live/dist/mcpServer.mjs
```

### Other MCP clients

Clients without a native integration use the same server entry in their MCP configuration file:

```json
{
  "graph-it-live": {
    "type": "stdio",
    "command": "node",
    "args": ["<extension>/dist/mcpServer.mjs"]
  }
}
```

Use the client expected top-level key (`servers` or `mcpServers`). See the [MCP server instructions](#mcp-server) for ready-to-copy VS Code, Cursor and Codex examples.

## Configuration

Set these options in VS Code settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| `graph-it-live.performanceProfile` | `default` | Select `default`, `low-memory`, `high-performance`, or `custom` |
| `graph-it-live.enableMcpServer` | `false` | Enable the built-in MCP server |
| `graph-it-live.maxDepth` | `50` | Limit dependency traversal depth |
| `graph-it-live.excludeNodeModules` | `true` | Exclude dependencies from `node_modules` |
| `graph-it-live.enableBackgroundIndexing` | `true` | Build reverse-dependency indexes in the background |
| `graph-it-live.unusedDependencyMode` | `hide` | Hide or dim unused dependencies |
| `graph-it-live.communityMode` | `path` | Group graph communities by folder (`path`) or by import structure (`louvain`); same as CLI `--communities` |
| `graph-it-live.preIndexCallGraph` | `true` | Pre-index the Live Call Graph |
| `graph-it-live.symbolViewLayout` | `hierarchical` | Select `hierarchical`, `force-directed`, or `radial` |

Workspace indexing (extension and MCP) skips paths listed in the root `.gitignore`, plus `tests/fixtures/` and `out-*/` by default. Add a root `.graphitignore` with gitignore syntax to exclude more paths, or negate a rule to include it again, for example `!tests/fixtures/`.

`performanceProfile` sets indexing concurrency, cache sizes, and unused-analysis limits. To tune them by hand, select `custom` and edit the **Advanced: Performance overrides** section (search `@tag:advanced graph-it-live` in the Settings editor). The other profiles ignore these overrides.

## Supported languages

| Language | File graph | Symbol View | Live Call Graph |
| --- | :---: | :---: | :---: |
| TypeScript / JavaScript | Yes | Yes | Yes |
| Vue / Svelte | Yes | Yes | Yes |
| Python | Yes | Yes | Yes |
| Rust | Yes | Yes | Yes |
| C# / Go / Java | Yes | No | Yes |
| GraphQL | Yes | No | Yes |

## Documentation

- [Design decisions](docs/DESIGN.md) — product scope, responsibilities, and why
- [Development guide](docs/DEVELOPMENT.md) — setup, builds, tests, and WASM architecture
- [Architecture guide](docs/architecture.md) — Architecture view, `graphit.architecture.json` rules, and `check-architecture`

## Development

Requirements: Node.js 22 or later and npm.

```bash
git clone https://github.com/sjh354/Graph-It-Live.git
cd graph-it-live
npm install
npm run build
```

Press F5 in VS Code to launch the Extension Development Host.

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the extension and copy WASM assets |
| `npm test` | Run unit tests |
| `npm run test:vscode` | Run VS Code E2E tests |
| `npm run lint` | Run ESLint |
| `npm run check:types` | Run strict TypeScript checks |
| `npm run package` | Build the VSIX package |
| `npm run package:verify` | Verify package contents |

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full project structure, test strategy, WASM details, and troubleshooting.

## License

MIT. See [LICENSE](LICENSE).

Language icons are provided by [SuperTinyIcons](https://github.com/edent/SuperTinyIcons) under the CC0-1.0 license.

