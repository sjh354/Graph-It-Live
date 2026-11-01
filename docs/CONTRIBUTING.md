# Contributing to Graph-It-Live

Thank you for your interest in contributing to Graph-It-Live! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Documentation](#documentation)
- [Releasing](#releasing)

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful and constructive in all interactions.

Report vulnerabilities privately, never in a public issue: see [SECURITY.md](SECURITY.md).

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

```bash
git clone https://github.com/YOUR_USERNAME/Graph-It-Live.git
cd Graph-It-Live
```

3. **Add upstream remote**:

```bash
git remote add upstream https://github.com/magic5644/Graph-It-Live.git
```

4. **Install dependencies**:

```bash
nvm use # optional, uses Node.js 22 when nvm is installed
npm install
```

5. **Build the extension**:

```bash
npm run build           # Build VS Code extension
npm run build:cli       # Build standalone CLI (dist/graph-it.js)
```

For detailed development setup instructions, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Development Setup

### Prerequisites

- **Node.js**: v22 or higher
- **VS Code**: v1.96.0 or higher
- **Git**: For version control

**Note**: No build tools required! The extension uses WebAssembly (WASM) parsers.

### Development Workflow

1. **Create a feature branch**:

```bash
git checkout -b feature/your-feature-name
```

2. **Start development**:

```bash
# Start watch mode for automatic rebuilds
npm run watch

# In VS Code, press F5 to launch Extension Development Host
```

3. **Make your changes** and test them in the Extension Development Host

4. **Run tests**:

```bash
npm test
npm run test:vscode
```

For complete development workflow details, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Reporting Issues

Open an issue with the matching form (bug, feature or performance). Give a priority (P1 to P3), a minimal reproduction on a neutral fixture (never private code), the root cause when you know it, and acceptance criteria. Search existing issues first.

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-symbol-analysis` - New features
- `fix/parser-crash` - Bug fixes
- `refactor/improve-caching` - Code refactoring
- `docs/update-readme` - Documentation updates
- `test/add-e2e-tests` - Test additions

### Commit Messages

Follow the Conventional Commits style:

- `feat:` - New features or capabilities
- `fix:` - Bug fixes and corrections
- `refactor:` - Code restructuring without behavior changes
- `test:` - Adding or updating tests
- `docs:` - Documentation updates
- `chore:` - Maintenance tasks, dependency updates
- `perf:` - Performance improvements
- `style:` - Code formatting, linting fixes

**Examples**:

```
feat: add symbol-level call hierarchy analysis
fix: resolve cross-platform path handling in tests
refactor: extract common analyzer utilities
test: add e2e tests for unused dependency filtering
docs: update WASM architecture documentation
```

### Code Style

- **TypeScript**: Use strict mode, avoid `any` types
- **ESLint**: Run `npm run lint` before committing
- **Formatting**: Follow existing code style
- **Naming**: Use camelCase for variables/functions, PascalCase for classes/types


## Testing

### Test Requirements

All contributions must include appropriate tests:

1. **Unit Tests**: For new functions, classes, and modules
   - Use mocked parsers (WASM doesn't work in Node.js)
   - Located in `tests/` with `*.test.ts` naming
   - Run with: `npm test`

2. **E2E Tests**: For new user-facing features (MANDATORY)
   - Use real WASM parsers in VS Code's Electron environment
   - Located in `tests/vscode-e2e/suite/`
   - Run with: `npm run test:vscode` or `npm run test:vscode:vsix`

3. **Property-Based Tests**: For universal properties
   - Use fast-check library
   - Minimum 100 iterations per test
   - Include feature tag and property description

### Running Tests

```bash
# Unit tests (fast, mocked parsers)
npm test

# CLI unit tests
npm run test:cli

# E2E tests from source (development mode)
npm run test:vscode

# E2E tests from packaged .vsix (production mode, required before release)
npm run test:vscode:vsix

# Only some E2E suites (glob relative to the compiled tests/vscode-e2e folder)
E2E_SUITE_GLOB='**/architectureView.test.js' npm run test:vscode

# Coverage report
npm run test:coverage
```

Regular CI runs the VS Code E2E suites on Linux only. To run them on Windows and macOS, use the
**VS Code E2E (Windows/macOS)** workflow (`.github/workflows/e2e-os.yml`):

- **Actions → VS Code E2E (Windows/macOS) → Run workflow**, with inputs `os` (`both`,
  `windows-latest` or `macos-latest`), `suite` (the `E2E_SUITE_GLOB`, default
  `**/architectureView.test.js`; `**/**.test.js` runs every suite) and `vscode-version`
  (empty for stable);
- or add the label `e2e:all-os` to a pull request: it runs the default suite on both OSes, and
  again on every push while the label stays.

Each run uploads its xunit report as the `e2e-test-report-<OS>` artifact.

### Cross-Platform Testing

All tests must work on Windows, Linux, and macOS:

- Use `path.join()` or `path.resolve()` for file paths
- Use `String.raw` for Windows path literals in test data
- Normalize paths with `normalizePath()` from `src/shared/path.ts`

For complete testing guidelines, see [DEVELOPMENT.md](DEVELOPMENT.md#testing).

## Submitting Changes

### Before Submitting

1. **Lint and type check**:

```bash
npm run lint
npm run check:types
```

2. **Run all tests**:

```bash
npm test
npm run test:vscode
npm run test:vscode:vsix # required when webviews or E2E tests change
```

3. **Verify package** (if build config changed):

```bash
npm run build -- --production
npm run package
npm run package:verify
```

4. **Update documentation** if needed

### Pull Request Process

1. **Update your branch** with latest upstream changes:

```bash
git fetch upstream
git rebase upstream/main
```

2. **Push your changes** to your fork:

```bash
git push origin feature/your-feature-name
```

3. **Create a Pull Request** on GitHub with:
   - **Clear title** following commit message conventions
   - **Description** of changes and motivation
   - **Test results** (commands and outcomes)
   - **Screenshots/GIFs** for UI changes
   - **Link to related issues** if applicable

4. **Address review feedback** promptly

### Pull Request Checklist

- [ ] Code follows project style and conventions
- [ ] All tests pass (`npm test`, `npm run test:vscode`)
- [ ] New tests added for new functionality
- [ ] E2E tests added for user-facing features
- [ ] Documentation updated if needed
- [ ] Commit messages follow Conventional Commits style
- [ ] Cross-platform compatibility verified
- [ ] Package verification passed (if build config changed)

### Required PR Evidence

For all PRs, include command output (or CI links) for:

- `npm run lint`
- `npm run check:types`
- `npm test`

For changes to the VS Code webviews (`src/webview/**`) or to E2E tests, include:

- `npm run test:vscode:vsix`

For build config or dependency changes (`esbuild.js`, `.vscodeignore`, `package.json`), include:

- `npm run package:verify` (must print `✅ No .map files in package`)
- `npx vsce ls graph-it-live-*.vsix | grep "\.wasm$"`
- `ls -lh graph-it-live-*.vsix` (target ≤ 20 MB; warn if above)

Use `.github/pull_request_template.md` and complete all checkboxes before requesting review.

## Coding Standards

The rules are owned by `AGENTS.md` and `.agent/rules/`; do not restate them here.

- Run `npm run lint` and `npm run check:types` before committing.
- TypeScript stays strict, `any` is avoided, and ESLint decides formatting.
- Build filesystem paths with `node:path` and normalize with `normalizePath()` before path keys enter Sets or Maps.

Cross-platform requirements are in [development/CROSS_PLATFORM_TESTING.md](development/CROSS_PLATFORM_TESTING.md).

## Documentation

Update documentation in the same change when behavior, commands, settings, or build/test steps change. A doc that describes removed behavior is deleted, not archived.

- **README.md**: user-facing setup and features.
- **docs/DESIGN.md**: product and design decisions, and why.
- **docs/DEVELOPMENT.md**: setup, build, tests, WASM, troubleshooting.
- **docs/README.md**: index of every other document.
- **AGENTS.md** and **.agent/rules/**: agent working rules.
- **Inline comments**: WHY for non-obvious constraints, not WHAT the code states.

Style: concise, factual, code examples where they help, TOC kept current, screenshots/GIFs for UI features.

## WASM and Packaging

WASM parsers are copied assets, not bundled JavaScript; unit tests mock them and E2E tests load the real ones. Details: [DEVELOPMENT.md](DEVELOPMENT.md#wasm-architecture).

After any change to `esbuild.js`, `.vscodeignore`, or dependencies, the VSIX must contain zero `.map` files and every required `.wasm`/`.scm` asset. Procedure and expected output: [DEVELOPMENT.md](DEVELOPMENT.md#package-verification).

## Releasing

The version is not committed: workflows set it from the tag at publish time.

1. Bring the documentation up to date with the code first (`README.md`, `docs/`, plugin skills; see `.agent/rules/release.md`), in its own PR(s).
2. For new user-facing features, add their screenshots and animated GIFs to `media/`, show them in `README.md` and `site/index.html` with an English explanation, in their own PR. Captures show only this repository's code (Graph-It-Live or `tests/fixtures/**`), never third-party code. Demo media stays out of the VSIX: the stores show the README images from GitHub.
3. Then merge a PR that adds a `## v<version>` section at the top of `changelog.md`, presenting each feature with an example and its image. The release fails before publishing anything when this section is missing.
4. Push the tag `v<version>` on `main`, or create the release (and its tag) in the GitHub UI. Either way the tag push starts `.github/workflows/release.yml`.
5. `release.yml` validates, packages and publishes the VSIX to the VS Code Marketplace and Open VSX, then writes the GitHub release:
   - attaches the VSIX;
   - **replaces** the release body (it never appends) with the output of `node scripts/release-notes.mjs <tag> <file>`: the `changelog.md` section, the PRs merged since the previous `v*` tag grouped by Conventional Commit type of the PR title (breaking changes first: `!` or a `BREAKING CHANGE:` footer; bot PRs under chores), a *Contributors* line crediting every human PR author, and the *Full Changelog* compare link.

   Notes typed when creating the release in the UI are overwritten, and re-running the workflow gives the same body.
6. `Publish (Selective)` (`.github/workflows/publish-npm.yml`) publishes the CLI to npm and, optionally, the stores. It only attaches the VSIX to the release and never changes its body.
   - Its validation runs the unit tests on Linux, macOS and Windows; VS Code E2E tests and VSIX packaging run only when a store is selected.
   - Set `skip_tests` only for the tag that `release.yml` already validated. A failed or cancelled validation never publishes.
   - The npm package ships the esbuild bundles of the CLI, MCP server and workers, so its manifest declares only the packages they import at runtime: `web-tree-sitter`, `ink` and `react`, with the ranges of `package.json`. `scripts/npm-package.mjs` writes that manifest (`NPM_RUNTIME_DEPENDENCIES`); a new external in an `esbuild.js` CLI, MCP or worker bundle goes in that list too. The extension's `package.json` and the VSIX keep all their dependencies.
   - Before `npm publish`, and in CI on Linux, macOS and Windows, `node scripts/smoke-npm-package.mjs` packs that manifest with the built `dist/`, installs the tarball with `--ignore-scripts` in an empty folder, then runs `graph-it --version`, `graph-it summary` and, through `graph-it serve`, MCP `initialize`, `tools/list` and tool calls in the MCP worker on a Python fixture (so `web-tree-sitter` loads). It also loads `ink` and `react` for the REPL. Run `npm run build:cli` before running it locally, on Node.js 22.18 or later (it imports `scripts/mcpSession.ts`).

Preview the release body locally (requires `gh` authenticated and the tags fetched):

```bash
node scripts/release-notes.mjs v1.18.0 release-notes.md
```

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **GitHub Discussions**: Ask questions or share ideas
- **Documentation**: Check `docs/` directory for detailed guides
- **[docs/DEVELOPMENT.md](DEVELOPMENT.md)**: setup, builds, tests, WASM, troubleshooting

## License

By contributing to Graph-It-Live, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Thank you for contributing to Graph-It-Live! Your contributions help make dependency analysis better for everyone.
