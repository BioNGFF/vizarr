import * as fs from "node:fs";
import * as http from "node:http";
import type { Server } from "node:http";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..", "fixtures", "local");

/**
 * Serves `fixtures/local` over loopback, so a test can read a real OME-Zarr through
 * the same path a browser would -- FetchStore, HTTP, zarrita, the parsers -- without
 * depending on anything outside this machine.
 *
 * Loopback rather than a file:// store on purpose. The store is the part most likely
 * to break on a dependency upgrade, and reading bytes off disk would not exercise it.
 */
export async function startFixtureServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = http.createServer((req, res) => {
    // Vizarr is served from a different origin to the data it reads, so the fixture
    // server answers as a public bucket does.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

    const requested = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = path.join(ROOT, requested);
    // Nothing outside the fixture directory is served, whatever the path says.
    if (!file.startsWith(`${ROOT}${path.sep}`)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, contents) => {
      if (error) {
        // A missing key is how zarrita discovers that a node is absent -- a group
        // with no labels, a well with no image -- so this is an ordinary answer.
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "application/octet-stream" }).end(contents);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the fixture server to be listening on a port");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
