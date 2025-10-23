import { ZoomOutMap } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useAtomValue } from "jotai";
import { useLayerState, useSourceData, useViewState } from "../../hooks";
import { type VizarrLayer, viewportAtom } from "../../state";
import { fitImageToViewport, getLayerSize } from "../../utils";

export function LayerFitToViewportButton() {
  const [sourceData] = useSourceData();
  const [layer] = useLayerState();
  const [, setViewState] = useViewState();
  const viewport = useAtomValue(viewportAtom);

  const fitToViewport = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (viewport) {
      setViewState(() => ({
        ...fitImageToViewport({
          image: getLayerSize({ props: layer.layerProps } as VizarrLayer),
          viewport: viewport,
          padding: viewport.width < 400 ? 10 : viewport.width < 600 ? 30 : 50,
          matrix: layer.layerProps.modelMatrix,
        }),
        width: viewport.width,
        height: viewport.height,
      }));
    }
  };

  return (
    <IconButton
      component="span"
      aria-label={`fit-layer-to-viewport-${sourceData.id}`}
      onClick={fitToViewport}
      sx={{
        backgroundColor: "transparent",
        color: `rgb(255, 255, 255, ${layer.on ? 1 : 0.5})`,
      }}
    >
      <ZoomOutMap />
    </IconButton>
  );
}
