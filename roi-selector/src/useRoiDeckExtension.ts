import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";

import { type OverlayPolygon, currentImageBoundsAtom, currentTInfoAtom, currentZInfoAtom, deckExtensionsAtom } from "@biongff/vizarr";

import {
  boundsToPolygonXY,
  nextAvailableColor,
  normalizeRoiBounds,
  pendingRoiAtom,
  roiDrawStateAtom,
  savedRoisAtom,
  toXY,
} from "./state";

/**
 * Hook that registers ROI overlay layers, click and hover handlers
 * with the viewer's deck.gl extension system.
 *
 * This keeps all ROI ↔ deck.gl interaction out of the core Viewer component.
 * Call this once from the top-level RoiSelector component.
 */
export function useRoiDeckExtension() {
  const [roiDrawState, setRoiDrawState] = useAtom(roiDrawStateAtom);
  const isDrawing = roiDrawState !== null;
  const savedRois = useAtomValue(savedRoisAtom);
  const [pendingRoi, setPendingRoi] = useAtom(pendingRoiAtom);
  const zInfo = useAtomValue(currentZInfoAtom);
  const tInfo = useAtomValue(currentTInfoAtom);
  const imageBounds = useAtomValue(currentImageBoundsAtom);
  const currentZ = zInfo?.zValue ?? null;
  const currentT = tInfo?.tValue ?? null;

  const nextRoiColor = nextAvailableColor(savedRois);

  const roiCorner1 =
    roiDrawState && typeof roiDrawState === "object" && "corner1" in roiDrawState ? roiDrawState.corner1 : null;

  // Track mouse position for the preview rectangle (only while placing second corner).
  const [roiMousePos, setRoiMousePos] = useState<[number, number] | null>(null);

  const setExtensions = useSetAtom(deckExtensionsAtom);

  // ---- Build overlay polygon specifications ----
  const overlays = useMemo(() => {
    const result: OverlayPolygon[] = [];

    // Saved ROIs — filtered by visibility and current Z/T planes
    for (const roi of savedRois) {
      if (!roi.visible) continue;
      const bounds = normalizeRoiBounds(roi);
      if (currentZ !== null && bounds.min.z !== undefined && bounds.max.z !== undefined && (currentZ < bounds.min.z || currentZ > bounds.max.z)) continue;
      if (currentT !== null && bounds.min.t !== undefined && bounds.max.t !== undefined && (currentT < bounds.min.t || currentT > bounds.max.t)) continue;
      result.push({
        id: `roi-saved-${roi.id}`,
        polygon: boundsToPolygonXY(bounds),
        fillColor: [...roi.color, 40],
        lineColor: [...roi.color, 200],
      });
    }

    // Pending ROI (drawn but not yet saved/discarded)
    if (pendingRoi) {
      result.push({
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
      result.push({
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

    return result;
  }, [savedRois, pendingRoi, nextRoiColor, currentZ, currentT, roiCorner1, roiMousePos]);

  // ---- Click handler (place ROI corners, clamped to image bounds) ----
  const onClick = useCallback(
    (coordinate: [number, number]): boolean => {
      if (!isDrawing) return false;

      const [rawX, rawY] = coordinate;
      const clampXY = (v: number, max: number) => Math.max(0, Math.min(Math.round(v), max));
      const x = imageBounds ? clampXY(rawX, imageBounds.xMax) : Math.round(rawX);
      const y = imageBounds ? clampXY(rawY, imageBounds.yMax) : Math.round(rawY);
      const clampZ = (z: number) =>
        imageBounds?.zMax !== null && imageBounds?.zMax !== undefined ? Math.max(0, Math.min(z, imageBounds.zMax)) : z;
      const clampT = (t: number) =>
        imageBounds?.tMax !== null && imageBounds?.tMax !== undefined ? Math.max(0, Math.min(t, imageBounds.tMax)) : t;

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

  // ---- Register / update extension ----
  useEffect(() => {
    setExtensions((prev) => ({
      ...prev,
      "roi-selector": {
        overlays,
        onClick,
        onHover,
        cursor: isDrawing ? "crosshair" : undefined,
      },
    }));
  }, [overlays, onClick, onHover, isDrawing, setExtensions]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      setExtensions((prev) => {
        const { "roi-selector": _, ...rest } = prev;
        return rest;
      });
    };
  }, [setExtensions]);
}
