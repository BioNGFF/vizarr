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

Raise that merge with the **Open release PR** workflow, from the Actions tab or:

```
gh workflow run release-pr.yml
```

It opens (or refreshes) a `dev` → `main` pull request listing what is about to ship,
grouped the way semantic-release reads it, so the kind of release is visible before
the merge rather than after. It refuses when `dev` holds nothing new.

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
pnpm dev     the app at http://localhost:5173
pnpm test    the test suite
pnpm check   typecheck, which builds the libraries first
pnpm lint    biome ci
pnpm fix     biome check --write
pnpm build   all packages
```

Run `pnpm check` and `pnpm lint` before handing work over. `pnpm check` is the slow
one and catches what the tests do not.

## Tests

**`pnpm test` currently reads real data over the network** — 171 of its 184 tests
fetch from IDR and elsewhere — so it is slow, and it fails when a server we do not
control is slow or down. Allow for that before concluding a change broke something:
run it again, and check whether the failures are all fetches.

Splitting it into an offline default suite and an opt-in remote one is in progress;
see #141 and #142. Once that lands, `pnpm test` is the offline suite, `pnpm test:remote`
is the corpus, and a test needing a server we do not run belongs in `tests/remote/`.
Until then, prefer not to add more tests that fetch.

## Things that are easy to get wrong

- **`CONTRIBUTING.md` covers the same ground for outside contributors.** Keep the two
  in step; if you change the workflow here, change it there.
- **Versions in `package.json` are not edited by hand.** semantic-release owns them.
- **`main` is the default branch**, so a `gh` command without an explicit base will
  target it. Pass `--base dev`.
- **The release commit carries `[skip ci]`**, so no workflow runs on it. Anything
  that needs to see the bumped version must trigger on the release, not the push.
- **Measure before claiming.** Several conclusions in this repository's history have
  turned out to rest on a number nobody checked — a slow CI run that was queue time
  rather than compute, a test that passed offline for the wrong reason. If a claim
  about behaviour can be run, run it, and quote what came back.
