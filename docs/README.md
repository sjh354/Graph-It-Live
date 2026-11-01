# Graph-It-Live Documentation

**Last Updated:** 2026-11-01

Every document outside the root [README](../README.md) and [`.agents/`](../.agents/AGENTS.md).

Each fact has one owner. Do not restate it here; link to the file that owns it.

| Owns | File |
| --- | --- |
| Product and design decisions, and why | [DESIGN.md](DESIGN.md) |
| Setup, build, tests, WASM, troubleshooting, release steps | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Architecture view: concepts, rules, `check-architecture` | [architecture.md](architecture.md) |
| Windows/macOS/Linux path handling and testing | [development/CROSS_PLATFORM_TESTING.md](development/CROSS_PLATFORM_TESTING.md) |
| Agent working rules | [`.agents/AGENTS.md`](../.agents/AGENTS.md), [`.agents/rules/`](../.agents/rules/) |
| User-facing setup and features | [README.md](../README.md) |
| Release history | [changelog.md](../changelog.md) |

## Diagrams

| File | Shows |
| --- | --- |
| [architecture/architecture-concepts.svg](architecture/architecture-concepts.svg) | Units, groups and files of the Architecture view; source [`.mmd`](architecture/architecture-concepts.mmd) |
| [architecture/graph-it-live-architecture.svg](architecture/graph-it-live-architecture.svg) | The `src/analyzer/architecture` module and its consumers; source [`.mmd`](architecture/graph-it-live-architecture.mmd) |

Architecture diagrams are the only hand-drawn visuals left. Regenerate codemaps and file counts with `graph-it` instead of storing them here.
