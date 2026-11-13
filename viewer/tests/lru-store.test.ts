import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import * as zarr from "zarrita";
import { lru } from "../src/lru-store";

/**
 * The cache in front of a remote store, and what it does with an answer it did not like.
 *
 * Offline, against a server on loopback that can be made to refuse and then relent --
 * which is what re-authenticating, a corrected CORS header or a restarted backend looks
 * like from the client. Counting the requests it receives is the only way to tell a
 * cached answer from a fresh one, which is why these drive a real store over HTTP rather
 * than a stub.
 */
const ROOT = path.resolve(__dirname, "..", "..", "fixtures", "local");
const METADATA = "/image-v05.zarr/zarr.json";

let server: http.Server;
let origin: string;
/** Flipped by a test to make the server refuse; counted to see who reached it. */
let serving: boolean;
let requests: number;

beforeEach(async () => {
  serving = true;
  requests = 0;
  server = http.createServer((req, res) => {
    requests += 1;
    if (!serving) {
      res.writeHead(403).end();
      return;
    }
    const file = path.join(ROOT, decodeURIComponent((req.url ?? "/").split("?")[0]));
    fs.readFile(file, (error, contents) => {
      if (error) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200).end(contents);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  origin = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const store = () => lru(new zarr.FetchStore(origin));

describe("get", () => {
  test("reads once and serves the second read from the cache", async () => {
    const cached = store();
    expect(await cached.get(METADATA)).toBeDefined();
    expect(await cached.get(METADATA)).toBeDefined();
    expect(requests).toBe(1);
  });

  test("asks again after a failure, rather than repeating it", async () => {
    const cached = store();
    serving = false;
    await expect(cached.get(METADATA)).rejects.toThrow(/403/);

    // Whatever was wrong is put right: a sign-in, a header, a restarted server.
    serving = true;
    const before = requests;
    expect(await cached.get(METADATA)).toBeDefined();
    // The point of the test. Before this fix the count stayed at zero and the second
    // read returned the first one's rejection, so no amount of fixing the cause helped.
    expect(requests - before).toBe(1);
  });

  test("still caches an absent key, which is an answer rather than a failure", async () => {
    const cached = store();
    // 404 is how zarrita discovers a node is not there -- a group with no labels, a well
    // with no image. Asking twice would cost a request for every one of those.
    expect(await cached.get("/image-v05.zarr/labels/zarr.json")).toBeUndefined();
    expect(await cached.get("/image-v05.zarr/labels/zarr.json")).toBeUndefined();
    expect(requests).toBe(1);
  });
});

describe("getRange", () => {
  const range = { offset: 0, length: 16 };

  test("reads once and serves the second read from the cache", async () => {
    const cached = store();
    expect(await cached.getRange?.(METADATA, range)).toBeDefined();
    expect(await cached.getRange?.(METADATA, range)).toBeDefined();
    expect(requests).toBe(1);
  });

  test("asks again after a failure, as it already did", async () => {
    const cached = store();
    serving = false;
    await expect(cached.getRange?.(METADATA, range)).rejects.toThrow(/403/);

    serving = true;
    const before = requests;
    expect(await cached.getRange?.(METADATA, range)).toBeDefined();
    expect(requests - before).toBe(1);
  });

  test("keeps a range apart from the whole key", async () => {
    const cached = store();
    await cached.get(METADATA);
    await cached.getRange?.(METADATA, range);
    // Two different reads of one key, so two requests: a cache that confused them would
    // hand back the wrong bytes.
    expect(requests).toBe(2);
  });
});
