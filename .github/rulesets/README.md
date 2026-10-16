# Rulesets

Definitions of the repository rulesets (Settings, Rules, Rulesets, Import). They are applied by hand; keep these files and the settings in sync.

| File | Target | What it enforces |
|---|---|---|
| `default-branches.json` | `develop`, `main`, `release/*`, `hotfix/*` | Pull requests only (squash), resolved threads, signed commits, linear history, no force push or deletion, the `pnpm verify` and `commitlint` checks, CodeQL and code quality |
| `all-branches.json` | every branch | Signed commits, Conventional Branch names, Conventional Commits messages, files up to 5 MB, no executables |
| `tags.json` | every tag | `vMAJOR.MINOR.PATCH` names, signed tags, no moving or deleting |

The `e2e` job in `.github/workflows/ci.yml` is not a required check because browser tests are load-sensitive; add it to the required checks once it is stable in CI.
