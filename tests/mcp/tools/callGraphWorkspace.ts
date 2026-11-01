/** Throwaway workspace indexed through the MCP call graph tool itself, for call graph tests. */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LanguageService } from "@/analyzer/LanguageService";
import { workerState } from "@/mcp/shared/state";
import { ensureCallGraphReady } from "@/mcp/tools/callgraph";

// The call graph parsers load from dist/wasm (built before the tests in CI).
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const wasmBuilt = fs.existsSync(path.join(REPO_ROOT, "dist/wasm/sqljs.wasm"));

/** Rewrite a file without moving its mtime: only an explicit invalidation can notice. */
export function rewriteKeepingMtime(filePath: string, content: string): void {
  const { atime, mtime } = fs.statSync(filePath);
  fs.writeFileSync(filePath, content);
  fs.utimesSync(filePath, atime, mtime);
}

/** Create `<tmp>/src/<name>` for each entry of `files`, then index the workspace. */
export async function indexWorkspace(
  prefix: string,
  files: Record<string, string>,
): Promise<{ tmpDir: string; runtime: { dispose: () => Promise<void> } }> {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  fs.mkdirSync(path.join(tmpDir, "src"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(tmpDir, "src", name), content);

  LanguageService.reset();
  workerState.config = {
    rootDir: tmpDir,
    excludeNodeModules: true,
    maxDepth: 10,
    extensionPath: REPO_ROOT,
  };
  workerState.isReady = true;
  // The MCP worker normally builds these from the Spider; the call graph tests only
  // need invalidation and reference lookups, so small stubs keep the setup independent of the CLI.
  workerState.spider = {
    invalidateFile: () => true,
    findReferencingFiles: async () => [],
    isReverseIndexEnabled: () => true,
    clearCache: () => {},
    buildFullIndex: async () => ({ indexedFiles: 0 }),
    getCacheStatsAsync: async () => ({ dependencyCache: { size: 0 } }),
  } as never;
  workerState.parser = {} as never;
  workerState.resolver = {} as never;
  await ensureCallGraphReady();
  return { tmpDir, runtime: { dispose: async () => workerState.reset() } };
}
