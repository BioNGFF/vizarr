# Working in this repository

BioNGFF's fork of [hms-dbmi/vizarr](https://github.com/hms-dbmi/vizarr): an OME-Zarr
viewer, as a pnpm monorepo.

| package | what it is |
| --- | --- |
| `viewer` | `@biongff/vizarr`, the viewer itself |
| `anndata-zarr` | `@biongff/anndata-zarr`, the tables plugin |
| `roi-selector` | `@biongff/roi-selector`, the ROI plugin |
| `sites/app` | the deployed application, which composes the above |

pnpm 9.5.0, Node 22. `pnpm install` from the root.

## Issue, branch, pull request

Work starts from an issue, so there is a written record of the problem separate from
the change that answers it. File one before opening a pull request, and say in it what
is wrong and how it was established, not only what to do about it.

**Branch from `dev`.** It is the integration branch and the base for ordinary work:

```
git fetch origin && git checkout -b <type>/<short-name> origin/dev
```

Branch from an existing feature branch only when the work genuinely depends on it —
when it edits the same files, or builds on something not yet merged. Say so in the
pull request, because the base is then not the default and a reviewer will want to
know why. 

**Pull requests target `dev`.** Both `dev` and `main` are protected: no force pushes,
no deletion, Copilot review, and **one approving review** before merge. You cannot
approve your own, so a pull request needs someone else. 

**`dev` merges into `main` to release.** Pushing to `main` runs semantic-release,
which decides the version, tags it, writes `CHANGELOG.md`, and commits the bumped
`package.json` files back. Nothing else should move versions.

That merge is raised for you. The **Release PR** workflow runs on every push to
`dev`, so a `dev` to `main` pull request is always open whenever `dev` is ahead, and is
rewritten on each merge to list what is currently waiting, grouped the way
semantic-release reads it, so the kind of release is visible before the merge rather
than after. 

When `dev` holds nothing new it opens nothing and says so, rather than failing.

To refresh it by hand, from the Actions tab or:

```
gh workflow run release-pr.yml
```

Run that way it does fail when there is nothing to release, because asking for a
release that cannot happen is a mistake worth hearing about.

That pull request is not another review of the code -- everything on `dev` was
reviewed on the way in -- but `main` still requires an approving review, so someone
other than whoever opened it has to approve. Its purpose is to publish.

## Commit messages decide the release

semantic-release reads them, so the prefix is not decoration:

| prefix | effect |
| --- | --- |
| `fix:` | patch release |
| `feat:` | minor release |
| `feat!:`, or `BREAKING CHANGE:` in the body | major release |
| `chore:`, `docs:`, `refactor:`, `style:`, `test:` | no release |

Scope in brackets where it helps: `fix(viewer): …`. Write the body for someone
reading `git log` in a year, who has the diff already and wants to know why.

Do not commit unless asked. The user reviews before anything is recorded.

## Commands

```
pnpm dev          the app at http://localhost:5173
pnpm docs:dev     the API docs at http://localhost:8080, rebuilt as you edit
pnpm test         the offline suite
pnpm test:remote  the corpus, which reads real images over the network
pnpm check        typecheck, which builds the libraries first
pnpm lint         biome ci
pnpm fix          biome check --write
pnpm build        all packages
pnpm build:docs   the API site into docs/build
```

Run `pnpm check` and `pnpm lint` before handing work over. `pnpm check` is the slow
one and catches what the tests do not.

## Tests

**`pnpm test` is the offline suite** — 46 tests against fixtures this repository
generates, no network at all. It is what CI runs, and it takes about 15 seconds.

**`pnpm test:remote` is the corpus**, which reads real images from IDR and elsewhere.
It is slow, and it fails when a server we do not control is slow or down, so it is
opt-in and CI does not run it. A test that needs a server we do not run belongs in
`tests/remote/`.

That split is not cosmetic. While the corpus ran by default it took the *deploy* down
twice — releases 1.4.0 and 1.4.1 both failed on a closed socket to EBI, in a workflow
whose job was to publish a build that had already passed. Think twice before putting a
fetch anywhere that has to succeed.

## Things that are easy to get wrong

- **`CONTRIBUTING.md` covers the same ground for outside contributors.** Keep the two
  in step; if you change the workflow here, change it there.
- **Versions in `package.json` are not edited by hand.** semantic-release owns them.
- **`main` is the default branch**, so a `gh` command without an explicit base will
  target it. Pass `--base dev`.
- **The release commit carries `[skip ci]`**, so no workflow runs on it. Anything
  that needs to see the bumped version must trigger on the release, not the push.
- **Check, lint and test live in one place**, `.github/workflows/ci.yml`, which runs on
  pull requests and which the release calls through `workflow_call`. Do not paste those
  steps into another workflow; call this one.
- **Setup lives in `.github/actions/setup`**, and the order inside it matters: pnpm,
  then Node with `cache: pnpm`, then the install. Installing earlier — inside
  `pnpm/action-setup` via `run_install` — runs before the store cache is restored, and
  every run then downloads every package again.
- **Deploying from a tag needs the `github-pages` environment to allow tags.** It is
  set to selected refs, and a `v*` **tag** rule is not the same thing as a branch rule
  named `v*`.
- **Measure before claiming.** Several conclusions in this repository's history have
  turned out to rest on a number nobody checked — a slow CI run that was queue time
  rather than compute, a test that passed offline for the wrong reason. If a claim
  about behaviour can be run, run it, and quote what came back.
