# Plan — final pre-release verification + npm packaging

## Context
End-of-session wrap-up. The proxy + GUI + docs are done; one critical bug (sidecar
`max_output_tokens`) was just fixed. Now: verify release-readiness and make the package
**npm-publishable**. opencodex is **bun-native** (uses `Bun.serve`, the `ocx` bin is a `.ts`
file with `#!/usr/bin/env bun`), so it ships as a bun package — consumers need bun.

## Findings
- `opencodex` is **available** on npm (404 — unclaimed).
- `src/cli.ts` already has the `#!/usr/bin/env bun` shebang ✓; `LICENSE` exists ✓; `gui/dist` builds ✓.
- **Blockers for publish:**
  1. No `files` allowlist → npm would publish src + devlog + docs-site (bloat) but **NOT `gui/dist`**
     (it's gitignored) → `ocx gui` would 404 for installed users.
  2. No `.npmignore` → npm falls back to `.gitignore`, which excludes `gui/dist`.
  3. No build-on-publish → stale/missing GUI in the tarball.
  4. Missing `repository` / `homepage` / `bugs` / `engines` metadata.

## Changes (B)
- `package.json`: add
  - `"files": ["src", "gui/dist", "README.md", "LICENSE"]` (ship the built GUI, drop dev dirs),
  - `"repository"`, `"homepage"` (docs site), `"bugs"`,
  - `"engines": { "bun": ">=1.1.0" }`,
  - `"build": "cd gui && bun install && bun run build"` + `"prepublishOnly"` that runs it (fresh GUI in every publish),
  - `"prepare"` left out (avoid building on plain installs).
- NEW `.npmignore` — its mere presence stops npm from consulting `.gitignore`, so `gui/dist` (in
  `files`) is included; also explicitly drops `gui/src`, `gui/node_modules`, tests, maps.
- Keep `version: 0.0.1` (the user bumps with `npm version` when ready — noted in D).

## Verify (C)
- `bun x tsc --noEmit` clean (proxy).
- `cd gui && bun run build` clean.
- **`npm pack --dry-run`** — assert the tarball CONTAINS `gui/dist/index.html` + `src/cli.ts` and
  does NOT contain `devlog/`, `docs-site/`, `gui/src/`, `node_modules/`.
- Re-confirm the sidecar fix (no `max_output_tokens` in src).

## Deliver (D) — npm publish steps (USER runs; not auto-published)
Publishing is outward-facing + needs the user's npm auth, so I prepare the package and hand off the
exact commands; I do not run `npm publish`.
