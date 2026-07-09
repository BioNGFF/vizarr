import { test } from "vitest";
import { loadBf2Raw } from "../src/ome";
import { open } from "zarrita";
import * as utils from "../src/utils";

const sources = [
  "https://livingobjects.ebi.ac.uk/idr/zarr/v0.4/idr0079A/idr0079_images.zarr",
  "https://livingobjects.ebi.ac.uk/idr/zarr/v0.5/idr0033A/BR00109990_C2.zarr",
  "https://livingobjects.ebi.ac.uk/idr/zarr/v0.5/idr0051/180712_H2B_22ss_Courtney1_20180712-163837_p00_c00_preview.zarr",
  "https://livingobjects.ebi.ac.uk/idr/zarr/v0.5/idr0026/3.66.9-6.141020_15-41-29.00.ome.zarr",
  "https://livingobjects.ebi.ac.uk/idr/zarr/v0.4/idr0048A/9846151.zarr",
  "https://livingobjects.ebi.ac.uk/idr/zarr/v0.2/idr0070A/9838562.zarr",
  "https://livingobjects.ebi.ac.uk/idr/zarr/v0.4/idr0056B/7361.zarr",
  "https://livingobjects.ebi.ac.uk/idr/zarr/v0.4/idr0128E/9701.zarr",
  "https://haniffa.cog.sanger.ac.uk/pcnsl/xenium/BRA-4/KP_PCNSL-CS1-BRA-0-FFPE-1-raw.zarr",
  "https://haniffa.cog.sanger.ac.uk/pcnsl/xenium/BRA-4/KP_PCNSL-CS1-BRA-0-FFPE-1-raw-HE.zarr",
  "https://haniffa.cog.sanger.ac.uk/pcnsl/xenium/BRA-1/KP_PCNSL-CS2-BRA-0-FFPE-1-raw.zarr",
  "https://haniffa.cog.sanger.ac.uk/pcnsl/xenium/BRA-2/KP_PCNSL-CS3-BRA-0-FFPE-1-raw.zarr",
  "https://haniffa.cog.sanger.ac.uk/pcnsl/xenium/BRA-3/KP_PCNSL-CS4-BRA-0-FFPE-1-raw.zarr",
];

for (const source of sources) {
  test(`Can successfully parse XML data from bioformats2raw file ${source}`, async () => {
    const location = await utils.normalizeStore(source);
    const group = await open(location, { kind: "group" });
    const metadata: Ome.Bioformats2rawlayout = group.attrs;

    const data = await loadBf2Raw({ source: source }, group, metadata);
  });
}
