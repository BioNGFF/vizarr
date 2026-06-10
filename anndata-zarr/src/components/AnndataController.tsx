import React, { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

import { FeatureSelect } from "./FeatureSelect";
import { ObsSelect } from "./ObsSelect";


import { useAnndataColors, useTableLabels } from "../hooks";
export type LabelType = 'observation' | 'feature'

export const AnndataController = ({ adata, callback = () => { } }: { adata: string, callback: Function }) => {
  const [selectedLabel, setSelectedLabel] = useState<{ labelIndex: string, type: LabelType } | undefined>(undefined)

  const url = { url: new URL(adata) }

  function handleLabelSelect(labelIndex: string, labelType: 'feature' | 'observation') {
    setSelectedLabel(
      {
        labelIndex: labelIndex,
        type: labelType
      }
    )
  }

  const labels = useTableLabels(url.url)

  //A necessary evil for now, I think in principle the UI should be more or less agnostic of whether it is an observation or a feature.
  const selectedLabelDisplayData = labels.data && selectedLabel ? labels.data.filter((label) => label.labelIndex === selectedLabel.labelIndex)[0] : undefined
  const selectedFeature = selectedLabelDisplayData?.type === 'feature' ? selectedLabelDisplayData.labelIndex : undefined
  const selectedObservation = selectedLabelDisplayData?.type === 'observation' ? selectedLabelDisplayData.labelIndex : undefined

  const colorData = useAnndataColors(url.url, selectedLabel, { enabled: !!selectedLabel })

  useEffect(() => {
    if (colorData?.isError) {
      callback(null);
      return;
    }
    if (!colorData?.isLoading && colorData?.data) {

      callback(colorData.data.colors);
    }
  }, [colorData, callback]);

  return (
    <Stack sx={{ height: "100%" }}>
      <Box sx={{ height: "50%" }}>
        {labels.data && <FeatureSelect featureNames={labels.data.filter((label) => label.type === 'feature').map((metadata) => metadata.labelIndex)} selectedFeatureIndex={selectedFeature} onFeatureSelect={handleLabelSelect} legendData={selectedFeature ? colorData.data : undefined} />}
      </Box>
      <Box sx={{ height: "50%" }}>
        {labels.data && <ObsSelect observations={labels.data.filter((label) => label.type === 'observation')} selectedObservation={selectedObservation} onObservationSelect={handleLabelSelect} legendData={selectedObservation ? colorData.data : undefined} />}
      </Box>

    </Stack>
  );
};
