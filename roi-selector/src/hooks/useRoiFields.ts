import { useAtom, useAtomValue } from "jotai";
import React, { useEffect, useRef, useState } from "react";

import { currentImageBoundsAtom, currentZInfoAtom } from "@biongff/vizarr";

import {
  type ImageBounds,
  type PendingRoi,
  type RoiDrawState,
  type SavedRoi,
  boundsToCoords,
  clampToBounds,
  coordsToRoi,
  nextAvailableColor,
  normalizeRoiBounds,
  pendingRoiAtom,
  roiDrawStateAtom,
  savedRoisAtom,
} from "../state";

export type CoordKey = "x1" | "y1" | "x2" | "y2" | "z1" | "z2";
export type CoordValues = Record<CoordKey, string>;

export interface UseRoiFieldsReturn {
  coords: CoordValues;
  onCoordChange: (key: CoordKey, value: string) => void;
  // Derived / shared state
  hasZAxis: boolean;
  zInfo: { zValue: number; zMax: number } | null;
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
  });

  const [editingRoiId, setEditingRoiId] = useState<string | null>(null);

  const zInfo = useAtomValue(currentZInfoAtom);
  const imageBounds = useAtomValue(currentImageBoundsAtom);
  const hasZAxis = zInfo !== null;

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
      const bn = normalizeRoiBounds(pendingRoi);
      const b = imageBounds ? clampToBounds(bn, imageBounds) : bn;
      setCoords(boundsToCoords(b) as CoordValues);
    }
  }, [pendingRoi, imageBounds]);

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
        const next = { ...prev, [key]: value };
        syncFieldsToPending(next);
        return next;
      });
    },
    [syncFieldsToPending],
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
    const b = imageBounds ? clampToBounds(normalizeRoiBounds(raw), imageBounds) : normalizeRoiBounds(raw);
    setSavedRois((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        corner1: [b.x1, b.y1],
        corner2: [b.x2, b.y2],
        z1: b.z1,
        z2: b.z2,
        color: nextAvailableColor(prev),
        visible: true,
      },
    ]);
    setPendingRoi(null);
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
    const bn = normalizeRoiBounds(roi);
    const b = imageBounds ? clampToBounds(bn, imageBounds) : bn;
    setCoords(boundsToCoords(b) as CoordValues);
  };

  const handleUpdateRoi = () => {
    editOriginal.current = null;
    setEditingRoiId(null);
  };

  const handleCancelEdit = () => {
    if (editOriginal.current && editingRoiId) {
      const orig = editOriginal.current;
      setSavedRois((prev) => prev.map((r) => (r.id === editingRoiId ? orig : r)));
    }
    editOriginal.current = null;
    setEditingRoiId(null);
  };

  return {
    coords,
    onCoordChange,
    hasZAxis,
    zInfo,
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
