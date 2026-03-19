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

1. Create a new feature branch:

```bash
git checkout main -b your-feature-branch-name
```

2. Make your changes, then stage and commit:

```bash
git add .
git commit -m "Describe your changes"
```

## Sharing Your Changes

Push your branch to your fork:

```bash
git push -u origin your-feature-branch-name
```

Create a pull request (PR) against the `main` branch of `BioNGFF/vizarr`.

> **Tip:** Before submitting your PR, make sure your code is formatted and linted:

```bash
pnpm fix   # formats code using Biome
pnpm lint  # checks for linting issues
```

Your PR will automatically be checked by the CI workflow.

## Building a Production Version

If you need to build or release a new version locally:

```bash
pnpm build                        # builds all packages
pnpm version [major|minor|patch]  # updates versions across packages
pnpm publish                      # publishes package(s) if you have permissions
```

> For development pre-releases (e.g., dev branches), use `pnpm publish --tag dev`.

## Recommended VSCode Extensions

* **[Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)** – Code formatting and linting