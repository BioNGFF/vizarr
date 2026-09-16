import { useCallback, useEffect, useMemo, useState } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

import { FeatureSelect } from "./FeatureSelect";
import { ObsSelect } from "./ObsSelect";

import { useAnndataColors, useTableLabels } from "../hooks";
export type LabelType = "observation" | "feature";

export type labelColor = {
  labelValue: number;
  rgba: [r: number, g: number, b: number, a: number];
  value?: string | number | null;
};

export const AnndataController = ({
  adata,
  callback = () => {},
}: { adata: string; callback: (colorData: labelColor[]) => void }) => {
  const [selectedLabel, setSelectedLabel] = useState<{ labelIndex: string; type: LabelType } | undefined>(undefined);

  const url = useMemo(() => new URL(adata), [adata]);

  const handleLabelSelect = useCallback((labelIndex: string, labelType: LabelType) => {
    setSelectedLabel({ labelIndex, type: labelType });
  }, []);

  const labels = useTableLabels(url);

  //A necessary evil for now, I think in principle the UI should be more or less agnostic of whether it is an observation or a feature.
  const selectedLabelDisplayData =
    labels.data && selectedLabel
      ? labels.data.find((label) => label.labelIndex === selectedLabel.labelIndex)
      : undefined;
  const selectedFeature =
    selectedLabelDisplayData?.type === "feature" ? selectedLabelDisplayData.labelIndex : undefined;
  const selectedObservation =
    selectedLabelDisplayData?.type === "observation" ? selectedLabelDisplayData.labelIndex : undefined;

  const featureNames = useMemo(
    () => (labels.data ?? []).filter((label) => label.type === "feature").map((metadata) => metadata.labelIndex),
    [labels.data],
  );
  const observations = useMemo(
    () => (labels.data ?? []).filter((label) => label.type === "observation"),
    [labels.data],
  );

  const { data: colourData, isError, isLoading } = useAnndataColors(url, selectedLabel, { enabled: !!selectedLabel });

  useEffect(() => {
    if (isError) {
      callback([]);
      return;
    }
    if (!isLoading && colourData) {
      callback(colourData.colors);
    }
  }, [colourData, isError, isLoading, callback]);

  return (
    <Stack sx={{ height: "100%" }}>
      <Box sx={{ height: "50%" }}>
        {labels.data && (
          <FeatureSelect
            featureNames={featureNames}
            selectedFeatureName={selectedFeature}
            onFeatureSelect={handleLabelSelect}
            legendData={selectedFeature ? colourData : undefined}
          />
        )}
      </Box>
      <Box sx={{ height: "50%" }}>
        {labels.data && (
          <ObsSelect
            observations={observations}
            selectedObservation={selectedObservation}
            onObservationSelect={handleLabelSelect}
            legendData={selectedObservation ? colourData : undefined}
          />
        )}
      </Box>
    </Stack>
  );
};
