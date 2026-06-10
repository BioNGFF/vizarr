import React, { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

import { FeatureSelect } from "./FeatureSelect";
import { ObsSelect } from "./ObsSelect";


import { useAnndataColors, useAnndataFeatures, useAnndataObs, type Feature, type FeatureParams, type ObservationParams } from "../hooks";
import type { Observation } from "../anndata";

interface ColourQueryParams {
  name: string,
  type: 'observation' | 'feature'
}

function getFeatureParams(feature: Feature): FeatureParams {
  return (
    { type: 'feature', params: feature }
  )
}

function getObservationParams(observation: string): ObservationParams {
  return (
    { type: 'observation', params: { name: observation } }
  )
}

export const AnndataController = ({ adata, callback = () => { } }: { adata: string, callback: Function }) => {
  const [feature, setFeature] = useState<Feature | undefined>(undefined);
  const [observation, setObservation] = useState<string | undefined>(undefined)
  const url = { url: new URL(adata) }

  const handleFeatureSelect = (f: Feature) => {
    setFeature(f);
    setObservation(undefined)
  };

  const handleObservationSelect = (o: string) => {
    setObservation(o);
    console.log('Setting observation to', o)
    setFeature(undefined)
  };


  const features = useAnndataFeatures(url);
  const observations = useAnndataObs(url);

  const param = feature ? getFeatureParams(feature) : (observation ? getObservationParams(observation) : undefined)

  const colorData = useAnndataColors(url.url, param, { enabled: !!param })

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
        {features.data && <FeatureSelect featureNames={features.data} selectedFeature={feature} onFeatureSelect={handleFeatureSelect} legendData={feature ? colorData.data : undefined} />}
      </Box>
      <Box sx={{ height: "50%" }}>
        {observations.data && <ObsSelect observations={observations.data} selectedObservation={observation} onObservationSelect={handleObservationSelect} legendData={observation ? colorData.data : undefined} />}
      </Box>

    </Stack>
  );
};
