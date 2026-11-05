import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { type CredentialProvider, isUnauthorized, setCredentialProvider } from "../src/credentials";
import { createSourceData } from "../src/io";

/**
 * A guarded server, so that "the credential arrived" is something the server decides
 * rather than something the test asserts about its own plumbing. Everything here is
 * loopback: no network, no bucket, nothing that can be slow or down.
 */
const ROOT = path.resolve(__dirname, "..", "..", "fixtures", "local");

type Guard = {
  /** What the server will accept right now, or null to accept anything. */
  expect: string | null;
  /** Every request it has answered, in order. */
  seen: Array<{ path: string; authorization: string | undefined; status: number }>;
};

let origin: string;
let server: http.Server;
let guard: Guard;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const requested = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const authorization = req.headers.authorization;
    const send = (status: number) => {
      guard.seen.push({ path: requested, authorization, status });
      res.writeHead(status).end();
    };

    if (guard.expect !== null && authorization !== guard.expect) {
      send(403);
      return;
    }
    const file = path.join(ROOT, requested);
    if (!file.startsWith(`${ROOT}${path.sep}`)) {
      send(403);
      return;
    }
    fs.readFile(file, (error, contents) => {
      if (error) {
        send(404);
        return;
      }
      guard.seen.push({ path: requested, authorization, status: 200 });
      res.writeHead(200, { "Content-Type": "application/octet-stream" }).end(contents);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  setCredentialProvider(undefined);
});

function guarded(expected: string | null): Guard {
  guard = { expect: expected, seen: [] };
  return guard;
}

const bearer =
  (token: () => string): CredentialProvider =>
  () => ({ headers: { Authorization: `Bearer ${token()}` } });

describe("reading a guarded store", () => {
  test("a store that needs no credential is unaffected by there being no provider", async () => {
    guarded(null);
    const [source] = await createSourceData({ source: `${origin}/image-v05.zarr` });

    expect(source.loader).toHaveLength(2);
    expect(guard.seen.every((request) => request.authorization === undefined)).toBe(true);
  });

  test("without a provider, a guarded store fails", async () => {
    guarded("Bearer letmein");

    await expect(createSourceData({ source: `${origin}/image-v05.zarr` })).rejects.toThrow();
  });

  test("the provider's credential reaches metadata and chunks alike", async () => {
    guarded("Bearer letmein");
    setCredentialProvider(bearer(() => "letmein"));

    const [source] = await createSourceData({ source: `${origin}/image-v05.zarr` });
    const { data } = await source.loader[0].getRaster({ selection: [0, 0, 0] });

    expect(data.length).toBeGreaterThan(0);
    // A chunk, not only the metadata: the two take different routes through zarrita.
    const chunks = guard.seen.filter((request) => request.path.includes("/c/"));
    expect(chunks.length).toBeGreaterThan(0);
    expect(guard.seen.every((request) => request.authorization === "Bearer letmein")).toBe(true);
    expect(guard.seen.some((request) => request.status === 403)).toBe(false);
  });

  test("the provider is consulted per request, so a rotated token is picked up", async () => {
    guarded("Bearer first");
    let token = "first";
    setCredentialProvider(bearer(() => token));

    const [source] = await createSourceData({ source: `${origin}/image-v05.zarr` });

    // Both sides rotate, as they would when a token expires and is reissued.
    token = "second";
    guard.expect = "Bearer second";
    const { data } = await source.loader[0].getRaster({ selection: [0, 0, 0] });

    expect(data.length).toBeGreaterThan(0);
    expect(guard.seen.map((request) => request.authorization)).toContain("Bearer first");
    expect(guard.seen.map((request) => request.authorization)).toContain("Bearer second");
  });
});

describe("recovering from a refusal", () => {
  test("a refused read is retried once with a fresh credential", async () => {
    guarded("Bearer good");
    // Hands over a stale token first, as a provider with a cached one would, and a
    // working one only when told the last was refused.
    const asked: boolean[] = [];
    setCredentialProvider(({ retry }) => {
      asked.push(retry);
      return { headers: { Authorization: `Bearer ${retry ? "good" : "stale"}` } };
    });

    const [source] = await createSourceData({ source: `${origin}/image-v05.zarr` });

    expect(source.loader).toHaveLength(2);
    // It asked without `retry`, was refused, and asked again with it.
    expect(asked).toContain(false);
    expect(asked).toContain(true);
    expect(guard.seen.some((request) => request.status === 403)).toBe(true);
    expect(guard.seen.some((request) => request.status === 200)).toBe(true);
  });

  test("a provider that throws leaves the ordinary failure message in place", async () => {
    guarded("Bearer letmein");
    setCredentialProvider(() => {
      throw new Error("the sign-in dialog was dismissed");
    });

    const error = await createSourceData({ source: `${origin}/image-v05.zarr` }).catch((e) => e);

    // The viewer's own "cannot read this" error, not the provider's, and certainly not
    // an unhandled rejection out of chunk loading.
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/403/);
    expect(error.message).not.toMatch(/sign-in dialog/);
    // The request was still attempted rather than abandoned at the provider.
    expect(guard.seen.length).toBeGreaterThan(0);
  });

  test("a read is not retried when the failure is not about the credential", async () => {
    guarded(null);
    let asked = 0;
    setCredentialProvider(() => {
      asked += 1;
      return {};
    });

    // 404 is how zarrita discovers a node is absent, so retrying it would double every
    // probe for an optional node -- labels, omero, a well that was never imaged.
    await expect(createSourceData({ source: `${origin}/not-here.zarr` })).rejects.toThrow();

    const attempts = guard.seen.filter((request) => request.status === 404).length;
    expect(attempts).toBeGreaterThan(0);
    // One ask per request, never two.
    expect(asked).toBe(guard.seen.length);
  });
});

describe("classifying a failure", () => {
  /**
   * zarrita puts the status in the message text and nowhere else, so this is the only
   * route to it. Pinned here: an upgrade that rewords it fails this test rather than
   * quietly stopping every retry.
   */
  test("401 and 403 are a wrong credential; 404 and 500 are not", () => {
    expect(isUnauthorized(new Error("Unexpected response status 401 Unauthorized"))).toBe(true);
    expect(isUnauthorized(new Error("Unexpected response status 403 Forbidden"))).toBe(true);
    expect(isUnauthorized(new Error("Unexpected response status 500 Internal Server Error"))).toBe(false);
    expect(isUnauthorized(new Error("Unexpected response status 404 Not Found"))).toBe(false);
    expect(isUnauthorized("not an error at all")).toBe(false);
  });

  test("zarrita still reports a refusal in the shape the classifier reads", async () => {
    guarded("Bearer letmein");
    const { FetchStore } = await import("zarrita");
    const store = new FetchStore(`${origin}/image-v05.zarr`);

    await expect(store.get("/zarr.json")).rejects.toThrow(/Unexpected response status 403/);
  });
});
