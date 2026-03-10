import { createServer } from "http-server";
import { afterAll, beforeAll } from "vitest";

let server;
beforeAll(() => {
  server = createServer({ root: process.env.VITE_TEST_STATIC_SERVER_DIRECTORY, cors: true });
  server.listen(process.env.VITE_TEST_STATIC_SERVER_PORT, process.env.VITE_TEST_STATIC_SERVER_HOST);
});

afterAll(() => {
  server.close();
});
