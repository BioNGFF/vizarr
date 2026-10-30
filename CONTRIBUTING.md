## Contributing to Vizarr

Thanks for your interest in `vizarr`. We welcome any input, feedback, bug reports, and contributions. 
Please do not hesitate to reach out if you have any questions!

## Setting Up Your Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

```bash
git clone https://github.com/your-username/vizarr.git
cd vizarr
```

3. **Set the upstream remote** to keep your fork in sync:

```bash
git remote add upstream git@github.com:BioNGFF/vizarr.git
```

4. **Install dependencies** using pnpm (if you don’t have pnpm, [install it](https://pnpm.io/installation)):

```bash
pnpm install
```

> **Note:** Node.js v20 or later is required. Use a version manager like [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage multiple Node versions.

## Running the Development Server

Start a local development server:

```bash
pnpm dev
```

* Access the app at [http://localhost:5173](http://localhost:5173)
* You can edit files in **`src/`** (TypeScript code) or **`public/`** (static assets) while the server is running. Changes update live in the browser.

Other useful scripts are available in `package.json`. Run them with:

```bash
pnpm <command>
```

## Making Changes

We work on `dev`. It is the integration branch, and `main` holds released code only,
so branch from `dev` and open your pull request against it.

1. Start from an up-to-date `dev`:

```bash
git fetch upstream
git checkout -b your-feature-branch-name upstream/dev
```

2. Make your changes, then stage and commit:

```bash
git add .
git commit -m "fix: describe your changes"
```

### Commit messages

Releases are cut automatically from commit messages, so the prefix is not decoration
— it chooses the next version number:

| prefix | effect |
| --- | --- |
| `fix:` | patch release |
| `feat:` | minor release |
| `feat!:`, or a `BREAKING CHANGE:` footer | major release |
| `chore:`, `docs:`, `refactor:`, `style:`, `test:` | no release on their own |

Add a scope where it helps: `fix(viewer): …`. If you are unsure which applies, open
the pull request anyway and we will help you pick.

## Running the tests

```bash
pnpm test
```

That is the offline suite: it runs against fixtures in this repository, needs no
network, and takes about fifteen seconds. It is also what CI runs on your pull
request, so if it passes locally it should pass there.

There is a second suite that reads real images over the network, from IDR and
elsewhere:

```bash
pnpm test:remote
```

It is slow, and it can fail because a server is slow rather than because your change
is wrong, so it is opt-in and CI does not run it. Run it if you have touched how
images are read. If the failures you see are all fetches, try again before assuming
the worst.

A new test belongs in the offline suite wherever it can. If it genuinely needs a
server we do not run, put it in `tests/remote/` so it stays out of everyone's way.

## Sharing Your Changes

Push your branch to your fork:

```bash
git push -u origin your-feature-branch-name
```

Create a pull request (PR) against the **`dev`** branch of `BioNGFF/vizarr`, not
`main`. Every pull request needs an approving review before it can be merged, so a
maintainer will take a look — please do not be put off if we ask questions.

Where possible, open an issue first and link to it. It gives us somewhere to discuss
the problem separately from the change that answers it.

> **Tip:** Before submitting your PR, make sure your code is formatted, linted and
> type-checks:

```bash
pnpm fix    # formats code using Biome
pnpm lint   # checks for linting issues
pnpm check  # type-checks, building the libraries first
```

Checks run in CI where they are configured for the branch you are targeting. If you
do not see any, that is not a sign your change is fine — run the three commands above
locally before asking for a review.

## Building

```bash
pnpm build  # builds all packages
```

## How releases happen

You do not need to do anything to release your change, and you should not edit version
numbers by hand.

Once your pull request is merged into `dev`, a maintainer merges `dev` into `main`.
That runs semantic-release, which reads the commit messages, picks the next version,
tags it, updates `CHANGELOG.md`, and publishes. This is why the commit prefixes above
matter.

## Recommended VSCode Extensions

* **[Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)** – Code formatting and linting