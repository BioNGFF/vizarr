import { useAtom } from "jotai";
import React, { useEffect, useRef, useState } from "react";

import { useViewerPlugin } from "@biongff/vizarr";

import {
  type ImageBounds,
  type PendingRoi,
  type RoiDrawState,
  type SavedRoi,
  boundsToCoords,
  clampToBounds,
  coordsToRoi,
  nextAvailableColor,
  nextDefaultRoiName,
  normalizeRoiBounds,
  pendingRoiAtom,
  roiDrawStateAtom,
  savedRoisAtom,
} from "../state";

export type CoordKey = "x1" | "y1" | "x2" | "y2" | "z1" | "z2" | "t1" | "t2";
export type CoordValues = Record<CoordKey, string>;

export interface UseRoiFieldsReturn {
  coords: CoordValues;
  onCoordChange: (key: CoordKey, value: string) => void;
  roiName: string;
  onRoiNameChange: (value: string) => void;
  // Derived / shared state
  hasZAxis: boolean;
  hasTAxis: boolean;
  zInfo: { zValue: number; zMax: number } | null;
  tInfo: { tValue: number; tMax: number } | null;
  imageBounds: ImageBounds | null;
  isDrawing: boolean;
  roiDrawState: RoiDrawState;
  pendingRoi: PendingRoi | null;
  savedRois: SavedRoi[];
  editingRoiId: string | null;
  // Handlers
  handleToggleDraw: () => void;
  handleSaveRoi: () => void;
  handleDiscardRoi: () => void;
  handleDeleteRoi: (id: string) => void;
  handleToggleVisibility: (id: string) => void;
  handleEditRoi: (roi: SavedRoi) => void;
  handleUpdateRoi: () => void;
  handleCancelEdit: () => void;
}

/**
 * Manages all ROI coordinate field state, draw-mode state, and the full
 * save / edit / delete / discard lifecycle.
 *
 * Navigation (zoom to ROI) and clipboard are intentionally left in the
 * parent component because they depend on viewer state and the `hasZAxis`
 * display flag that is already computed here and forwarded.
 */
export function useRoiFields(): UseRoiFieldsReturn {
  const [coords, setCoords] = useState<CoordValues>({
    x1: "",
    y1: "",
    x2: "",
    y2: "",
    z1: "",
    z2: "",
    t1: "",
    t2: "",
  });

  const [editingRoiId, setEditingRoiId] = useState<string | null>(null);
  const [roiName, setRoiName] = useState<string>("");

  const { zInfo, tInfo, imageBounds } = useViewerPlugin();
  const hasZAxis = zInfo !== null;
  const hasTAxis = tInfo !== null;
  const zMax = zInfo?.zMax ?? null;
  const tMax = tInfo?.tMax ?? null;

  const [roiDrawState, setRoiDrawState] = useAtom(roiDrawStateAtom);
  const isDrawing = roiDrawState !== null;

  const [savedRois, setSavedRois] = useAtom(savedRoisAtom);
  const [pendingRoi, setPendingRoi] = useAtom(pendingRoiAtom);

  // Prevents the pendingRoi → fields effect from re-running when we are the ones
  // writing to pendingRoi (e.g. while the user types in the fields).
  const internalUpdate = useRef(false);

  // Stash the original ROI values when entering edit mode so cancel can restore them.
  const editOriginal = useRef<SavedRoi | null>(null);

  // ---- Populate fields from external pendingRoi changes (draw-on-canvas) ----
  useEffect(() => {
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }
    if (pendingRoi) {
      const normalized = normalizeRoiBounds(pendingRoi);
      const clamped = imageBounds ? clampToBounds(normalized, imageBounds, zMax, tMax) : normalized;
      setCoords(boundsToCoords(clamped) as CoordValues);
    }
  }, [pendingRoi, imageBounds, zMax, tMax]);

  // ---- Live sync: field changes → atom (for overlay preview) ----
  const syncFieldsToPending = React.useCallback(
    (next: CoordValues) => {
      if (editingRoiId) {
        setSavedRois((prev) =>
          prev.map((r) => {
            if (r.id !== editingRoiId) return r;
            const parsed = coordsToRoi(next, r);
            return parsed ? { ...r, ...parsed } : r;
          }),
        );
        return;
      }

      setPendingRoi((prev) => {
        if (!prev) return prev;
        const parsed = coordsToRoi(next, prev);
        if (!parsed) return prev;
        internalUpdate.current = true;
        return parsed;
      });
    },
    [editingRoiId, setSavedRois, setPendingRoi],
  );

  const onCoordChange = React.useCallback(
    (key: CoordKey, value: string) => {
      setCoords((prev) => {
        // Clamp numeric value to image bounds when available
        let clamped = value;
        if (value !== "" && imageBounds) {
          const num = Number(value);
          if (!Number.isNaN(num)) {
            const limits: Partial<Record<CoordKey, number>> = {
              x1: imageBounds.xMax,
              x2: imageBounds.xMax,
              y1: imageBounds.yMax,
              y2: imageBounds.yMax,
              ...(zMax !== null ? { z1: zMax, z2: zMax } : {}),
              ...(tMax !== null ? { t1: tMax, t2: tMax } : {}),
            };
            const max = limits[key];
            if (max !== undefined) {
              clamped = String(Math.max(0, Math.min(num, max)));
            }
          }
        }
        const next = { ...prev, [key]: clamped };
        syncFieldsToPending(next);
        return next;
      });
    },
    [syncFieldsToPending, imageBounds, zMax, tMax],
  );

  // ---- Draw-mode toggle ----
  const handleToggleDraw = () => {
    if (isDrawing) {
      setRoiDrawState(null);
    } else {
      setRoiDrawState("waiting-first");
    }
  };

  // ---- Save pending ROI ----
  const handleSaveRoi = () => {
    if (!pendingRoi) return;
    const raw = coordsToRoi(coords, pendingRoi);
    if (!raw) return;
    const bounds = imageBounds
      ? clampToBounds(normalizeRoiBounds(raw), imageBounds, zMax, tMax)
      : normalizeRoiBounds(raw);
    setSavedRois((prev) => {
      const name = roiName.trim() || nextDefaultRoiName(prev);
      return [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          name,
          corner1: bounds.min,
          corner2: bounds.max,
          color: nextAvailableColor(prev),
          visible: true,
        },
      ];
    });
    setPendingRoi(null);
    setRoiName("");
  };

  const handleDiscardRoi = () => setPendingRoi(null);

  const handleDeleteRoi = (id: string) => {
    setSavedRois((prev) => prev.filter((r) => r.id !== id));
    if (editingRoiId === id) setEditingRoiId(null);
  };

  const handleToggleVisibility = (id: string) => {
    setSavedRois((prev) => prev.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)));
  };

  const handleEditRoi = (roi: SavedRoi) => {
    if (pendingRoi) setPendingRoi(null);
    if (isDrawing) setRoiDrawState(null);
    editOriginal.current = { ...roi };
    setEditingRoiId(roi.id);
    setRoiName(roi.name);
    const normalized = normalizeRoiBounds(roi);
    const clamped = imageBounds ? clampToBounds(normalized, imageBounds) : normalized;
    setCoords(boundsToCoords(clamped) as CoordValues);
  };

  const handleUpdateRoi = () => {
    if (editingRoiId) {
      const name = roiName.trim();
      if (name) {
        setSavedRois((prev) => prev.map((r) => (r.id === editingRoiId ? { ...r, name } : r)));
      }
    }
    editOriginal.current = null;
    setEditingRoiId(null);
    setRoiName("");
  };

  const handleCancelEdit = () => {
    if (editOriginal.current && editingRoiId) {
      const orig = editOriginal.current;
      setSavedRois((prev) => prev.map((r) => (r.id === editingRoiId ? orig : r)));
    }
    editOriginal.current = null;
    setEditingRoiId(null);
    setRoiName("");
  };

  return {
    coords,
    onCoordChange,
    roiName,
    onRoiNameChange: setRoiName,
    hasZAxis,
    hasTAxis,
    zInfo,
    tInfo,
    imageBounds,
    isDrawing,
    roiDrawState,
    pendingRoi,
    savedRois,
    editingRoiId,
    handleToggleDraw,
    handleSaveRoi,
    handleDiscardRoi,
    handleDeleteRoi,
    handleToggleVisibility,
    handleEditRoi,
    handleUpdateRoi,
    handleCancelEdit,
  };
}
