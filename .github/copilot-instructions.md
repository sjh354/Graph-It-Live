# Graph-It-Live Copilot Adapter

Use repository-wide rules from `AGENTS.md`. Path-scoped rules live in `.agents/rules/`; read only the files selected by the routing table in `AGENTS.md`.

For any exploration involving `.js`, `.jsx`, `.cjs`, `.mjs`, `.ts`, `.tsx`, `.cts`, or `.mts`, use Graph-It-Live MCP tools first, or `graph-it` after `graph-it scan`; only then inspect source directly to verify details or edit.

If loaded instructions conflict, stop and report the conflict instead of choosing arbitrarily.
