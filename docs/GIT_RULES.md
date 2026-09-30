# Git rules

How a change travels from a developer's machine to a release. The reasons behind
each rule are in the ADRs linked below; this page is the checklist.

## Branches

| Branch                                    | Role                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `dev`                                     | Default branch. Every pull request targets it.                                                                       |
| `main`                                    | Released code. Only receives the promotion pull request from `dev` and the release pull request from release-please. |
| `feature/…`, `fix/…`, `chore/…`, `docs/…` | Working branches, created from `dev`. The prefix is a convention, not enforced.                                      |

Never push directly to `dev` or `main`: both are protected.

```text
feature/xxx --merge commit--> dev --merge commit--> main --> tag + CHANGELOG
                               ^                      |
                               +----- back-merge -----+
```

## Merging

- **Merge commit only**, on `dev` and on `main`. No squash, no rebase merge
  — same rule as the backend template (ADR-0002 there). Every
  commit keeps its author and its own line in the history.
- Enforced by a ruleset on both branches, as in the backend template (ADR-0007
  there).
- To update a branch with the latest `dev`, prefer `git pull --rebase origin dev`.
  A merge from `dev` is accepted, but it adds noise to the history.
- After a release, `main` is merged back into `dev` automatically
  (`.github/workflows/back-merge.yml`).

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org), because every commit
reaches `main` and release-please builds the changelog and the version from them.

```text
<type>(<optional scope>)<optional !>: <subject>
```

| Type                                            | Changelog   | Version |
| ----------------------------------------------- | ----------- | ------- |
| `feat`                                          | Added       | minor   |
| `fix`                                           | Fixed       | patch   |
| `perf`                                          | Performance | patch   |
| `refactor`                                      | Changed     | patch   |
| `revert`                                        | Reverted    | patch   |
| `docs`, `test`, `chore`, `ci`, `build`, `style` | hidden      | none    |

A `!` after the type, or a `BREAKING CHANGE:` footer, is a breaking change: major
bump. Hidden types alone never trigger a release.

- Header at most 100 characters. Scope free. Subject case free.
- Messages written by git itself (`Merge …`, `Revert "…"`, `fixup! …`) are not
  checked.

Examples: `feat(season): show the live leaderboard`, `fix: reject empty names`,
`build(deps): bump nuxt`.

## Local hooks

Installed by `npm install` (the `prepare` script runs husky). Nothing else to do.

| Hook         | Does                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| `pre-commit` | lint-staged: `oxlint --fix` then `prettier --write` on staged files, re-staged automatically. |
| `commit-msg` | commitlint, same rules as CI (`.commitlintrc.json`).                                          |

Hooks can be skipped with `--no-verify`. CI runs the same checks and cannot be.

## Linters and formatter

| Tool     | Where                                             | Covers                                                                                                                  |
| -------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| oxlint   | pre-commit (staged files), CI with `--type-aware` | JavaScript / TypeScript, script blocks of `.vue` files                                                                  |
| ESLint   | CI, `npm run lint`                                | Vue templates and accessibility (ADR-FE-015). Rules already covered by oxlint are turned off by `eslint-plugin-oxlint`. |
| Prettier | pre-commit, CI `--check`                          | Formatting, config in `.prettierrc.json`                                                                                |

oxlint cannot replace ESLint yet: its JS plugins do not support custom parsers,
so `eslint-plugin-vuejs-accessibility` would see no template.

The commit that applied the Prettier config to the whole repository is listed in
`.git-blame-ignore-revs`, which GitHub reads on its own. Locally:
`git config blame.ignoreRevsFile .git-blame-ignore-revs`.

## Pull request checks

| Check                           | Required                                                   |
| ------------------------------- | ---------------------------------------------------------- |
| `Lint / oxlint`                 | yes                                                        |
| `Lint / eslint`                 | yes                                                        |
| `Lint / prettier`               | yes                                                        |
| `Lint / typecheck`              | yes                                                        |
| `Test / vitest`                 | yes                                                        |
| `Build / nuxt build`            | yes                                                        |
| `Commitlint`                    | yes                                                        |
| `Trivy Security Scan`           | yes (reports, never fails)                                 |
| `GitHub Actions audit` (zizmor) | yes                                                        |
| `E2E / cypress`                 | **no**, for now: the suite still has to prove it is stable |
| `Lighthouse / lighthouse`       | **no**, scores vary between runners (ADR-FE-014)           |
| `SonarQube Cloud scan`          | **no**, skipped on Dependabot pull requests                |

`dev` requires branches to be up to date before merging.

## Releases

1. Open a pull request from `dev` to `main`, merge it with a merge commit.
2. release-please opens or updates `chore(main): release X.Y.Z` on `main`.
3. Merging it writes `CHANGELOG.md`, bumps `package.json` and tags `vX.Y.Z`.
4. The back-merge workflow merges `main` into `dev`.
