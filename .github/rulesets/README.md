# Rulesets

Definitions of the repository rulesets (Settings, Rules, Rulesets, Import). They are applied by hand; keep these files and the settings in sync.

| File | Target | What it enforces |
|---|---|---|
| `default-branches.json` | `develop`, `main`, `release/*`, `hotfix/*` | Pull requests only (squash), resolved threads, signed commits, linear history, no force push or deletion, the `pnpm verify` and `commitlint` checks, CodeQL and code quality |
| `all-branches.json` | every branch | Signed commits |
| `tags.json` | every tag | Signed tags, no moving or deleting |

GitHub offers branch name, tag name, commit message and push (file size, extension) rules only to organization-owned repositories. Here the `commitlint` job checks the pull request title, its commits and the branch name instead (the title becomes the squash commit subject). Tag names (`vX.Y.Z`) are checked by `pnpm release` and the owner when tagging.

The `e2e` job in `.github/workflows/ci.yml` is not a required check because browser tests are load-sensitive; add it to the required checks once it is stable in CI.
