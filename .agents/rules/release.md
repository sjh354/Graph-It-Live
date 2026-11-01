---
paths:
  - ".github/workflows/release.yml"
  - ".github/workflows/publish-npm.yml"
  - "site/**"
  - "media/**"
  - ".vscodeignore"
---

# Release Preparation

Apply this file by explicit routing for any release preparation (docs, media, site, version, tag), even when no matched file is open. Order: docs PR → media and site PR → tag.

## Procedure

1. Land doc fixes in their own PR, then media and site in their own PR.
2. Push tag `v<version>` on `main`. `release.yml` validates, packages, publishes the VSIX to both stores, and attaches it to a GitHub release whose notes GitHub generates from the merged PRs.
3. `publish-npm.yml` publishes the CLI to npm. Its validation runs unit tests on Linux, macOS and Windows; E2E and VSIX packaging run only when a store is selected. Set `skip_tests` only for a tag `release.yml` already validated.
4. Tag only from `main` after CI, Review Gate and SonarCloud are green.

There is no changelog file. Release history is the GitHub releases page, generated from PR titles, so keep PR titles in Conventional Commit form (`feat:`, `fix:`, `docs:`) and put breaking changes in the PR description.

## Documentation first

Documentation must match shipped code before the tag. Never tag over stale docs.

1. Audit user-facing docs against code: `README.md` and `docs/**`.
2. Check facts from source, not memory: CLI commands/options (`src/cli`), MCP tools and parameters (`src/mcp`), settings and commands (`package.json` `contributes`), file paths, counts, versions.
3. Run `npm run sync:tool-descriptions -- --check`; fix drift.
4. Update or remove stale content; delete a doc that describes removed behavior instead of archiving it.
5. Land doc fixes in their own PR(s).

## Media and site

Users discover features through images, so every release showing new user-facing features ships new visuals. Land them in their own PR, after the feature PRs and before the tag.

1. Capture each new feature from the final build: animated GIF for flows (short and narrow, a few MB at most), PNG for still states. Name files `media/<feature>-<what>.{gif,png}`. `pr-assets/<issue>` branches hold earlier captures to reuse as sources, but only those that follow the next rule (not the OSS corpus shots, such as hono).
   - Show only this repository's code: Graph-It-Live itself, or `tests/fixtures/**` for other languages and project shapes. Never third-party code, OSS corpora or private code.
   - Accompany every image and GIF with an English explanation: alt text, a caption or short paragraph saying what it shows and how to get there (command, setting, click).
2. Show them in `README.md` and `site/index.html` (feature section, `og:image` when the headline feature changes). `.github/workflows/pages.yml` deploys the site when `site/**` or `media/**` lands on `main`.
3. Keep demo media out of the VSIX: `.vscodeignore` excludes `media/**` except the icon. `vsce` rewrites relative README images to `https://github.com/magic5644/Graph-It-Live/raw/HEAD/media/...`, and both stores publish that same VSIX. Never rename or delete a `media/` file that a published README still references.
4. Check the package: `npm run package && npm run package:verify`, then `ls -lh graph-it-live-*.vsix` (≤ 20 MB).

## Version

- Pick semver from content: feature → minor, fixes only → patch, breaking → major. Milestone name does not decide.
- The tag decides the published version; `package.json` is not committed with it.
