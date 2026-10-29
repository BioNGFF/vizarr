// @ts-nocheck
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";

import type { Server } from "node:http";
import { Group } from "zarrita";
import { createSourceData } from "../src/io";
import { HttpError, MetadataNotFoundError, openZarrRoot } from "../src/services/http";

let server: Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
let port: number;
let server_url: string;

afterEach(() => {
  server.close();
});

beforeEach(() => {
  server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.url === "/404") {
      res.writeHead(404);
      res.end("Not found!");
      return;
    }
    if (req.url === "/403") {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (req.url === "/400") {
      res.writeHead(400);
      res.end("Invalid request");
      return;
    }

    if (req.url === "/401") {
      res.writeHead(401);
      res.end("Forbidden");
      return;
    }
    const root = path.resolve(path.resolve(__dirname), "..", "..", "fixtures", "local");
    const relativePath = req.url;

    const fullPath = path.join(root, relativePath);

    fs.exists(fullPath, (exists) => {
      if (!exists) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(409);
      res.end();
      return;
    });
  });
  server.listen(() => {});
  port = server.address().port;
  server_url = `http://localhost:${port}`;
});

test("Enters test suite", async () => {
  expect(1 + 1).toBe(2);
});

test("Server responds with status code 404", async () => {
  const results = await Promise.allSettled([createSourceData({ source: `${server_url}/404` })]);
  results.forEach((result, index) => {
    expect(result.status).toBe("rejected");
    expect(result.reason).instanceOf(MetadataNotFoundError);
  });
});

test("Server responds with status code 403", async () => {
  const results = await Promise.allSettled([createSourceData({ source: `${server_url}/403` })]);
  results.forEach((result, index) => {
    expect(result.status).toBe("rejected");
    expect(result.reason.code).toBe(403);
    expect(result.reason).instanceOf(HttpError);
  });
});

test("Server responds with status code 401", async () => {
  const results = await Promise.allSettled([createSourceData({ source: `${server_url}/401` })]);
  results.forEach((result, index) => {
    expect(result.status).toBe("rejected");
    expect(result.reason.code).toBe(401);
    expect(result.reason).instanceOf(HttpError);
  });
});

test("Server handles zarr files with no metadata", async () => {
  const results = await Promise.allSettled([createSourceData({ source: `${server_url}/empty.zarr` })]);
  results.forEach((result, index) => {
    expect(result.status).toBe("rejected");
    expect(result.reason).toBeInstanceOf(MetadataNotFoundError);
  });
});

//Ensure that the error handling is not over-eager
test("Server handles zarr metadata errors elegantly", async () => {
  const source = "https://livingobjects.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240_labels.zarr";
  const result = await openZarrRoot(source);
  expect(result).toBeInstanceOf(Group);
});
