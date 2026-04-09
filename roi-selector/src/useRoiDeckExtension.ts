import { PolygonLayer } from "deck.gl";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useViewerPlugin } from "@biongff/vizarr";

import {
  boundsToPolygonXY,
  nextAvailableColor,
  normalizeRoiBounds,
  pendingRoiAtom,
  roiDrawStateAtom,
  savedRoisAtom,
  toXY,
} from "./state";

const PLUGIN_ID = "roi-selector";

/**
 * Hook that builds ROI overlay layers and registers click/hover handlers
 * with the viewer via ViewerPluginContext.
 *
 * The plugin owns the layer creation — the viewer just renders whatever layers
 * are handed to it, with no knowledge of ROI internals.
 */
export function useRoiDeckExtension() {
  const plugin = useViewerPlugin();
  const { imageBounds, zInfo, tInfo } = plugin;

  const [roiDrawState, setRoiDrawState] = useAtom(roiDrawStateAtom);
  const isDrawing = roiDrawState !== null;
  const savedRois = useAtomValue(savedRoisAtom);
  const [pendingRoi, setPendingRoi] = useAtom(pendingRoiAtom);
  const currentZ = zInfo?.zValue ?? null;
  const currentT = tInfo?.tValue ?? null;

  const nextRoiColor = nextAvailableColor(savedRois);

  const roiCorner1 =
    roiDrawState && typeof roiDrawState === "object" && "corner1" in roiDrawState ? roiDrawState.corner1 : null;

  // Track mouse position for the preview rectangle (only while placing second corner).
  const [roiMousePos, setRoiMousePos] = useState<[number, number] | null>(null);

  // ---- Build real deck.gl PolygonLayer instances ----
  const roiLayers = useMemo(() => {
    type PolySpec = {
      id: string;
      polygon: [number, number][];
      fillColor: [number, number, number, number];
      lineColor: [number, number, number, number];
    };
    const specs: PolySpec[] = [];

    // Saved ROIs — filtered by visibility and current Z/T planes
    for (const roi of savedRois) {
      if (!roi.visible) continue;
      const bounds = normalizeRoiBounds(roi);
      if (
        currentZ !== null &&
        bounds.min.z !== undefined &&
        bounds.max.z !== undefined &&
        (currentZ < bounds.min.z || currentZ > bounds.max.z)
      )
        continue;
      if (
        currentT !== null &&
        bounds.min.t !== undefined &&
        bounds.max.t !== undefined &&
        (currentT < bounds.min.t || currentT > bounds.max.t)
      )
        continue;
      specs.push({
        id: `roi-saved-${roi.id}`,
        polygon: boundsToPolygonXY(bounds),
        fillColor: [...roi.color, 40],
        lineColor: [...roi.color, 200],
      });
    }

    // Pending ROI (drawn but not yet saved/discarded)
    if (pendingRoi) {
      specs.push({
        id: "roi-pending",
        polygon: boundsToPolygonXY(normalizeRoiBounds(pendingRoi)),
        fillColor: [...nextRoiColor, 60],
        lineColor: [...nextRoiColor, 220],
      });
    }

    // Preview rectangle (corner1 placed, following mouse)
    if (roiCorner1 && roiMousePos) {
      const [x1, y1] = toXY(roiCorner1);
      const [x2, y2] = roiMousePos;
      specs.push({
        id: "roi-preview",
        polygon: [
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2],
        ],
        fillColor: [...nextRoiColor, 40],
        lineColor: [...nextRoiColor, 200],
      });
    }

    return specs.map(
      (spec) =>
        new PolygonLayer({
          id: spec.id,
          data: [{ polygon: spec.polygon }],
          getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
          getFillColor: spec.fillColor,
          getLineColor: spec.lineColor,
          getLineWidth: 2,
          lineWidthUnits: "pixels" as const,
          stroked: true,
          filled: true,
          pickable: false,
        }),
    );
  }, [savedRois, pendingRoi, nextRoiColor, currentZ, currentT, roiCorner1, roiMousePos]);

  // ---- Click handler (place ROI corners, clamped to image bounds) ----
  const onClick = useCallback(
    (coordinate: [number, number]): boolean => {
      if (!isDrawing) return false;

      const [rawX, rawY] = coordinate;
      const clampXY = (v: number, max: number) => Math.max(0, Math.min(Math.round(v), max));
      const x = imageBounds ? clampXY(rawX, imageBounds.xMax) : Math.round(rawX);
      const y = imageBounds ? clampXY(rawY, imageBounds.yMax) : Math.round(rawY);
      const clampZ = (z: number) => (zInfo ? Math.max(0, Math.min(z, zInfo.zMax)) : z);
      const clampT = (t: number) => (tInfo ? Math.max(0, Math.min(t, tInfo.tMax)) : t);

      if (roiDrawState === "waiting-first") {
        const corner: import("./state").RoiCorner = { x, y };
        if (zInfo) corner.z = clampZ(zInfo.zValue);
        if (tInfo) corner.t = clampT(tInfo.tValue);
        setRoiDrawState({ corner1: corner });
        return true;
      }

      if (roiDrawState && typeof roiDrawState === "object" && "corner1" in roiDrawState) {
        const corner: import("./state").RoiCorner = { x, y };
        if (zInfo) corner.z = clampZ(zInfo.zValue);
        if (tInfo) corner.t = clampT(tInfo.tValue);
        setPendingRoi({
          corner1: roiDrawState.corner1,
          corner2: corner,
        });
        setRoiDrawState(null);
        return true;
      }

      return false;
    },
    [isDrawing, roiDrawState, setRoiDrawState, setPendingRoi, zInfo, tInfo, imageBounds],
  );

  // ---- Hover handler (track mouse for preview rectangle) ----
  const onHover = useCallback(
    (coordinate: [number, number] | null) => {
      if (roiCorner1 && coordinate) {
        setRoiMousePos(coordinate);
      } else {
        setRoiMousePos(null);
      }
    },
    [roiCorner1],
  );

  // ---- Register layers with the viewer ----
  useEffect(() => {
    plugin.addLayers(PLUGIN_ID, {
      layers: roiLayers,
      cursor: isDrawing ? "crosshair" : undefined,
    });
  }, [roiLayers, isDrawing, plugin]);

  // ---- Register click handler ----
  useEffect(() => {
    plugin.addClickHandler(PLUGIN_ID, onClick);
  }, [onClick, plugin]);

  // ---- Register hover handler ----
  useEffect(() => {
    plugin.addHoverHandler(PLUGIN_ID, onHover);
  }, [onHover, plugin]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      plugin.removeLayers(PLUGIN_ID);
      plugin.removeClickHandler(PLUGIN_ID);
      plugin.removeHoverHandler(PLUGIN_ID);
    };
  }, [plugin]);
}
