import * as fs from "node:fs";
import * as http from "node:http";
import type { Server } from "node:http";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..", "fixtures", "local");

/**
 * Serves `fixtures/local` over loopback, so a test reads a real table through the same
 * path a browser would -- FetchStore, HTTP, zarrita -- without touching the network.
 *
 * The viewer package keeps its own copy of this. Two short servers are easier to follow
 * than one shared across package boundaries, and neither package should have to compile
 * the other's test sources to run its own.
 */
export async function startFixtureServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    const requested = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = path.join(ROOT, requested);
    if (!file.startsWith(`${ROOT}${path.sep}`)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, contents) => {
      if (error) {
        // A missing key is how zarrita discovers that a node is absent, so this is an
        // ordinary answer rather than a failure.
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
