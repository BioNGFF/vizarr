/**
 * Builds the docs, serves them, and rebuilds as you edit.
 *
 *   pnpm docs:dev              http://127.0.0.1:8080
 *   pnpm docs:dev --port 3000
 *
 * A full typedoc pass takes about twenty seconds, which is far too slow to iterate on
 * a stylesheet, so a change to the custom CSS is copied straight into the built output
 * instead. Everything else -- source, markdown, typedoc config -- needs the full run.
 *
 * The page reloads itself on rebuild through a server-sent event. The script that
 * listens for it is injected as the page is served, so the build output stays byte for
 * byte what gets published.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(root, "docs", "build");
const customCss = path.join(root, "docs", "viewer", "theme.css");

const portFlag = process.argv.indexOf("--port");
const port = portFlag === -1 ? 8080 : Number(process.argv[portFlag + 1]) || 8080;

/** Paths worth a full rebuild, relative to the repository root. */
const WATCHED = [
  "viewer/src",
  "roi-selector/src",
  "anndata-zarr/src",
  "docs/viewer",
  "typedoc.json",
  "viewer/typedoc.json",
  "anndata-zarr/typedoc.json",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Open event streams, one per tab with the site open. */
const clients = new Set();

function reloadClients() {
  for (const client of clients) {
    client.write("data: reload\n\n");
  }
}

const RELOAD_SNIPPET = '<script>new EventSource("/__reload").onmessage = () => location.reload();</script>';

let building = false;
let queued = false;

function typedoc() {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  const started = Date.now();
  process.stdout.write("building... ");
  const child = spawn("npx", ["typedoc"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  child.on("close", (code) => {
    building = false;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (code === 0) {
      console.log(`done in ${seconds}s`);
      reloadClients();
    } else {
      // Warnings are errors here, so a failure is usually a broken link or a type
      // that nothing documents. Show it and keep serving the last good build.
      console.log(`failed in ${seconds}s\n${output.trim()}`);
    }
    if (queued) {
      queued = false;
      typedoc();
    }
  });
}

/** A stylesheet edit lands in the built output directly; typedoc only copies it. */
function copyCss() {
  try {
    fs.copyFileSync(customCss, path.join(build, "assets", "custom.css"));
    console.log("css updated");
    reloadClients();
  } catch (error) {
    console.log(`css copy failed: ${error.message}`);
  }
}

let timer;
let cssOnly = true;

function onChange(file) {
  if (file.endsWith("~") || path.basename(file).startsWith(".")) return;
  if (path.resolve(file) !== customCss) cssOnly = false;
  clearTimeout(timer);
  // Editors write in bursts, and one save can arrive as several events.
  timer = setTimeout(() => {
    if (cssOnly) copyCss();
    else typedoc();
    cssOnly = true;
  }, 150);
}

for (const entry of WATCHED) {
  const full = path.join(root, entry);
  if (!fs.existsSync(full)) continue;
  fs.watch(full, { recursive: fs.statSync(full).isDirectory() }, (_event, name) => {
    onChange(name ? path.join(full, name) : full);
  });
}

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);

    if (url === "/__reload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 500\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    let file = path.join(build, url);
    // `build` alone would also admit a sibling directory whose name starts with it.
    if (file !== build && !file.startsWith(build + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404).end("Not found");
      return;
    }

    const type = MIME[path.extname(file)] ?? "application/octet-stream";
    if (type.startsWith("text/html")) {
      const html = fs.readFileSync(file, "utf8").replace("</body>", `${RELOAD_SNIPPET}</body>`);
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(html);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(fs.readFileSync(file));
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`docs on http://127.0.0.1:${port}`);
    if (fs.existsSync(path.join(build, "index.html")))
      console.log("serving the existing build; edit something to rebuild");
    else typedoc();
  });
