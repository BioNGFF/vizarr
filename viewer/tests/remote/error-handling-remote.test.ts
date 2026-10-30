import { expect, test } from "vitest";

import { Group } from "zarrita";
import { openZarrRoot } from "../../src/services/http";

/**
 * Reads a real label image, whose metadata is unusual enough to have tripped the error
 * handling before. Lives here rather than beside the other error-handling tests because
 * it is the only one of them that needs a server we do not run.
 */
test("Server handles zarr metadata errors elegantly", async () => {
  const source = "https://livingobjects.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240_labels.zarr";
  const result = await openZarrRoot(source);
  expect(result).toBeInstanceOf(Group);
});
