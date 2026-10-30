import { Grid, NativeSelect } from "@mui/material";
import { useSetAtom } from "jotai";
import React from "react";
import type { ChangeEvent } from "react";
import { useSourceData } from "../../hooks";
import { setAcquisitionAtom } from "../../state";
import { SectionHeading, denseSelectSx } from "./controls";

/** The option for "whichever the image lists first", which is what a plate loads by default. */
const NO_ACQUISITION = -1;

function AcquisitionController() {
  const [sourceData] = useSourceData();
  const setAcquisition = useSetAtom(setAcquisitionAtom);
  const { acquisitionId, acquisitions, id } = sourceData;

  // In time order where the metadata gives one. The order acquisitions are listed in is
  // not chronological -- in IDR's idr0001A the first measurement is listed last -- and
  // id order is no better, so a time series would otherwise read out of sequence. Sort
  // is stable, so acquisitions without a start time keep the order they came in.
  const ordered = React.useMemo(
    () => [...(acquisitions ?? [])].sort((a, b) => (a.starttime ?? 0) - (b.starttime ?? 0)),
    [acquisitions],
  );

  if (ordered.length === 0) {
    return null;
  }

  // Only a plate names its rows. The distinction matters for what "no choice" means: a
  // plate can draw one image per well so it falls back to the first acquisition, while
  // a well lays all of its images out and so shows every acquisition at once.
  const isPlate = Boolean(sourceData.rowNames);

  const handleSelectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    // Reloads this source in place. It used to rewrite the URL and reload the page,
    // which lost every other setting and the view along with it.
    setAcquisition({ id, acquisitionId: Number.parseInt(event.target.value) });
  };

  return (
    <>
      <SectionHeading>acquisition</SectionHeading>
      <Grid>
        <NativeSelect
          fullWidth
          sx={denseSelectSx}
          onChange={handleSelectionChange}
          value={acquisitionId ?? NO_ACQUISITION}
          inputProps={{ "aria-label": "Acquisition shown" }}
        >
          <option value={NO_ACQUISITION} key={NO_ACQUISITION}>
            {isPlate ? "First acquisition" : "All acquisitions"}
          </option>
          {ordered.map((acquisition) => (
            <option value={acquisition.id} key={acquisition.id}>
              {acquisition.name ?? `Acquisition ${acquisition.id}`}
            </option>
          ))}
        </NativeSelect>
      </Grid>
    </>
  );
}

export default AcquisitionController;
