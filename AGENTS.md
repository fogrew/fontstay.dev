# AGENTS.md

Static Astro site that generates metric-adjusted fallback font stacks. Full scope and roadmap: [`docs/plan.md`](docs/plan.md).

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm preview` | Astro dev server, static build to `dist/` plus the PWA step (service worker, `version.json`), serve the build |
| `pnpm check` | Compile messages, then typecheck (`astro check`) |
| `pnpm changelog` | Regenerate `CHANGELOG.md` (the `Unreleased` section) from Conventional Commits with git-cliff (`cliff.toml`) |
| `pnpm release <semver>` | On `release/v<semver>`: bump `package.json`, stamp `CHANGELOG.md` with the version; commit and signed tag are manual |
| `pnpm i18n:add <locale>` | Scaffold a new locale (settings, `messages/<locale>.json` copied from English, catalog entry) |
| `pnpm i18n:compile` | Regenerate the Paraglide runtime in `src/common/i18n/paraglide/` (gitignored) |
| `pnpm lint` / `pnpm lint:fix` / `pnpm format` | Biome lint + format |
| `pnpm lint:arch` | FEOD boundary check: `@feod/analyzer` (`.ts`/`.tsx`) run from `scripts/lint-arch.ts` after a sha256 check of its binary, with a scrubbed environment (build variables still reach the rest of the Cloudflare build, only the analyzer binary is isolated); plus a check for relative path literals in `.astro` files that leave their entity. After upgrading `@feod/analyzer`, vet the release and update `scripts/feod-analyzer.sha256.json` |
| `pnpm test` / `pnpm test:watch` | Vitest unit and property tests (`src/**/*.test.ts`) |
| `pnpm test:e2e` | Build, then Playwright e2e + axe against `astro preview`, then the worker suite in `tests/worker` (real Chromium worker) (first run: `pnpm exec playwright install chromium`) |
| `pnpm perf` | Initial JavaScript budget per page (gzip), read from `dist/` after a build; see [`docs/performance.md`](docs/performance.md) |
| `pnpm verify` | Gate: lint, architecture, typecheck, unit tests, build, performance budget. E2E is added once the Cloudflare spike (#7) settles |

Git hooks (lefthook, installed by `pnpm install`; reinstall with `pnpm exec lefthook install`): `pre-commit` runs Biome on staged files (fixes re-staged), then the FEOD check and `astro check` on the whole working tree (~6 s); `commit-msg` runs commitlint (~1 s).

## Work tracking

- All work goes through GitHub issues in `fogrew/fontstay.dev`. No change without an issue; reference it in the branch name and PR (`Closes #N`).
- Milestones map to plan phases. Labels: `type:*`, `area:*`, `priority:*`.
- Scope changes or new findings → new issue (or update the existing one), not silent drift.

## Security headers

The page runs under a strict CSP plus baseline headers (`public/_headers` and Astro's hashed CSP); see [`docs/security.md`](docs/security.md). Do not add inline `<style>` elements, inline event handlers or `'unsafe-*'` sources; relaxations need a justification in the PR. E2E tests run against `tests/e2e/serve.mjs`, which applies `_headers`, and fail on any CSP violation.

## Dependencies

Dependabot (`.github/dependabot.yml`, config only, no Actions) opens one weekly PR with grouped minor and patch updates and individual PRs for majors, against `develop`, with `chore(deps)` commit prefixes and a one-day cooldown matching `minimumReleaseAge`. Exact pins stay exact. `fontkitten` (patched) and `@feod/analyzer` (checksum-pinned) are excluded and updated by hand. Dependency PRs go through the review loop; the security review reads the release notes and the new transitive dependencies in the lockfile.

## Review loop

Review effort scales with risk:

- **Untrusted input** (font parsing, URL or CSS import, bookmarklet payloads, `postMessage`, stats JSON, CSP and headers): independent subagent reviews, run in parallel, repeated until clean:
  1. **Code review** — correctness, readability, FEOD boundaries, tests.
  2. **Security review** — hostile input, XSS, CSP, dependency risks.
  3. **Requirements review** — implementation vs the issue's acceptance criteria and `docs/plan.md`.
- **Other code** (engine, UI, generators): one reviewer covering the three angles, one round plus a re-check of the fixes.
- **Docs, config and chore PRs**: no agent review; pre-commit hooks and the Cloudflare build check them.

Reviewers that only read code work in an already installed checkout (no `pnpm install`, no worktree). Reviewers that run builds or probes use an isolated git worktree (`isolation: "worktree"`); remove it afterwards with `git worktree remove --force` (leftover worktrees under `.claude/` break Biome with nested-config errors). Unresolved or deferred findings become issues.

## Git

### Commits — [Conventional Commits](https://www.conventionalcommits.org/)

`<type>(<scope>)!: <subject>` — types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Breaking changes via `!` or a `BREAKING CHANGE:` footer. Subject in imperative mood, no trailing period. Enforced by commitlint in the `commit-msg` hook.

All commits and tags are GPG-signed. Never bypass signing.

### Branches — [Conventional Branch](https://conventional-branch.github.io/) + [git flow](https://nvie.com/posts/a-successful-git-branching-model/)

| Branch | From | Into | Purpose |
|---|---|---|---|
| `main` | — | — | Production; every commit is a tagged release. Cloudflare Workers Builds production branch. |
| `develop` | `main` | — | Integration branch; default PR target. |
| `feature/<issue>-<desc>` | `develop` | `develop` | New functionality, e.g. `feature/12-font-upload`. |
| `bugfix/<issue>-<desc>` | `develop` | `develop` | Non-urgent fixes. |
| `chore/<issue>-<desc>` | `develop` | `develop` | Tooling, deps, docs. |
| `release/v<semver>` | `develop` | `main` + `develop` | Release stabilization: version bump, changelog. |
| `hotfix/v<semver>` | `main` | `main` + `develop` | Urgent production fixes. |

Lowercase, hyphen-separated, issue number first.

### Merging

- Agents never push to `develop` or `main` and never merge a branch into them locally. Every change goes through a pull request from an issue branch, and an agent may squash-merge its own PR with `gh pr merge --squash` only when every required check is green and the branch is up to date; the rulesets enforce this.
- Rulesets (`.github/rulesets/`): pull requests only with squash merge, signed commits and tags, linear history, no force push or deletion, signed tags that cannot be moved or deleted. The `pnpm verify` and `commitlint` checks (which also validate the branch name, PR title and commits) from `.github/workflows/ci.yml` must pass. A squash merge uses the PR title as the commit subject, so the PR title is a Conventional Commit.
- Locally, `lefthook` refuses pushes to `develop`, `main`, `release/*` and `hotfix/*`, and `.claude/settings.json` denies pushes to them, merges and repository setting changes for agents.
- After the merge: GitHub's "automatically delete head branches" removes the remote branch; delete the local branch with `git branch -D <branch>` (a squash merge leaves it unmerged for git). `fetch.prune` is enabled so stale remote-tracking refs disappear on `git fetch`.

### Versioning — [SemVer](https://semver.org/)

`MAJOR.MINOR.PATCH`; pre-1.0 breaking changes bump MINOR. Version lives in `package.json`, tags are `v<semver>`.

### Changelog — [Keep a Changelog](https://keepachangelog.com/) + conventional changelog

`CHANGELOG.md` is generated from Conventional Commits by git-cliff into Keep a Changelog sections (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) under `Unreleased`, and stamped with the version on each `release/*` branch. Review the generated entries before release.

Mapping (`cliff.toml`): `feat` → Added; `refactor`, `perf`, `style` → Changed; `revert` → Removed; `fix` → Fixed; scope `security` → Security; scope `deprecate` → Deprecated. `docs`, `test`, `build`, `ci`, `chore` are left out. Run `pnpm changelog` to refresh `Unreleased`; the file is regenerated from the whole history, so do not edit it by hand between releases.

Release procedure:

1. `git switch -c release/v<semver> develop`.
2. `pnpm release <semver>` bumps `package.json` and stamps `CHANGELOG.md`, regenerating it from the whole history (clean tree and a matching `release/v<semver>` branch required). Review the generated entries.
3. Commit `chore(release): v<semver>` (signed), push the branch and open two pull requests from it, into `main` and into `develop`. The owner squash-merges both, then tags the updated `main` with `git tag -s v<semver>` and pushes the tag.

## Code

- FEOD architecture: levels `app`, `pages`, `modules`, `common`, `global`; imports only through an entity's root `index.ts`, direction per the [import matrix](https://fractal-oriented.tech/en/reference/import-matrix). Astro `srcDir` is `src/app`, so routes live in `src/app/pages`; `src/pages` is the FEOD pages level.
- Everything in the repo (code, comments, docs, commit messages) is in English.
- Minimal comments: only for non-obvious anti-patterns, one line.
- Every external source of data, code or inspiration is added to [`CREDITS.md`](CREDITS.md) in the same PR.
- UI strings only via i18n messages (`messages/<locale>.json`, English is the source of truth); in components use `messagesFor(locale)` from `@/common/i18n` and pass `locale` explicitly (pages are prerendered, so the global locale must not be relied on). Never hardcode user-visible text.
- Animate UI state changes with view transitions (FLIP-like): wrap panel and layout changes in `transition()` from `@/common/ui`, name the transitioned elements only while a transition runs (a permanent `view-transition-name` creates a stacking context), prefer panels over page navigation, and always respect `prefers-reduced-motion`.
- Accessibility target: WCAG 2.2 AA.
