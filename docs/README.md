# Graph-It-Live Documentation

**Last Updated:** 2026-11-01

Index of every document except the root [README](../README.md) (user-facing setup and features) and [`.agents/AGENTS.md`](../.agents/AGENTS.md) (agent working rules, with the path-scoped rules themselves in [`.agents/rules/`](../.agents/rules/)).

Each fact has one owner. Do not restate a rule here; link to the file that owns it.

| Owns | File |
| --- | --- |
| Product and design decisions, and why | [DESIGN.md](DESIGN.md) |
| Setup, build, tests, WASM, troubleshooting | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Contribution workflow, PR evidence, release order | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Agent working rules (path-scoped) | [`.agents/rules/`](../.agents/rules/) |

---

## Usage

| File | Description |
|------|-------------|
| [architecture.md](architecture.md) | Architecture view, `graphit.architecture.json` rules and roles, `check-architecture` |
| [examples/graph-it-review-gate.yml](examples/graph-it-review-gate.yml) | Consumer workflow for the Graph-It Review Gate GitHub Action |

## Architecture

| File | Description |
|------|-------------|
| [architecture/TOON_FORMAT.md](architecture/TOON_FORMAT.md) | TOON serialization format |
| [architecture/MCP_PAYLOAD_LIMITS.md](architecture/MCP_PAYLOAD_LIMITS.md) | MCP input validation and payload size limits |
| [architecture/MCP_DEBUG_LOGGING_SECURITY.md](architecture/MCP_DEBUG_LOGGING_SECURITY.md) | MCP debug logging: opt-in, rotation, privacy |

### Diagrams

| File | Description |
|------|-------------|
| [architecture/architecture-concepts.svg](architecture/architecture-concepts.svg) | Units, groups and files of the Architecture view; source [`.mmd`](architecture/architecture-concepts.mmd) |
| [architecture/graph-it-live-architecture.svg](architecture/graph-it-live-architecture.svg) | System diagram with the `src/analyzer/architecture` module and its consumers; source [`.mmd`](architecture/graph-it-live-architecture.mmd) |

### Architecture decision records

| File | Decision |
|------|----------|
| [architecture/ADR-F5-01-graph-context-gateway.md](architecture/ADR-F5-01-graph-context-gateway.md) | Unified graph context gateway |
| [architecture/ADR-S2-01-toon-field-mcp-compat.md](architecture/ADR-S2-01-toon-field-mcp-compat.md) | MCP compatibility of the `toon` field |
| [development/ADR-001-package-manager-choice.md](development/ADR-001-package-manager-choice.md) | npm vs Yarn |

## Development

| File | Description |
|------|-------------|
| [development/CROSS_PLATFORM_TESTING.md](development/CROSS_PLATFORM_TESTING.md) | Windows, macOS and Linux path handling and testing |

## Community

| File | Description |
|------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution workflow and conventions |
| [SECURITY.md](SECURITY.md) | How to report a vulnerability |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Contributor Covenant |

Finished one-off documents (sprint notes, implemented specs and plans) were removed in #301; they remain in Git history.
