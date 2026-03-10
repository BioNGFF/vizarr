import { test } from "vitest";
import { createSourceData } from "../src/io";

test("Can read .ozx file without error", async () => {
  const baseUrl = "http://" + process.env.VITE_TEST_STATIC_SERVER_HOST + ":" + process.env.VITE_TEST_STATIC_SERVER_PORT;
  const image = "backpack.ozx";

  const url = `${baseUrl}/${image}`;
  const config = {
    source: url,
  };

  await createSourceData(config);
});
