import { useAtom, useAtomValue } from "jotai";
import React, { useEffect, useRef, useState } from "react";

import { currentImageBoundsAtom, currentZInfoAtom } from "@biongff/vizarr";

import {
  clampToBounds,
  nextAvailableColor,
  normalizeRoiBounds,
  pendingRoiAtom,
  roiDrawStateAtom,
  savedRoisAtom,
  type ImageBounds,
  type PendingRoi,
  type RoiDrawState,
  type SavedRoi,
} from "../state";

export interface UseRoiFieldsReturn {
  // Coordinate field string values (kept as strings so the user can type freely)
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  z1: string;
  z2: string;
  // Per-field change handlers
  onX1Change: (v: string) => void;
  onY1Change: (v: string) => void;
  onX2Change: (v: string) => void;
  onY2Change: (v: string) => void;
  onZ1Change: (v: string) => void;
  onZ2Change: (v: string) => void;
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
  const [x1, setX1] = useState("");
  const [y1, setY1] = useState("");
  const [x2, setX2] = useState("");
  const [y2, setY2] = useState("");
  const [z1, setZ1] = useState("");
  const [z2, setZ2] = useState("");

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
      setX1(String(b.x1));
      setY1(String(b.y1));
      setX2(String(b.x2));
      setY2(String(b.y2));
      setZ1(String(b.z1));
      setZ2(String(b.z2));
    }
  }, [pendingRoi, imageBounds]);

  // ---- Live sync: field changes → atom (for overlay preview) ----
  const syncFieldsToPending = React.useCallback(
    (nx1: string, ny1: string, nx2: string, ny2: string, nz1: string, nz2: string) => {
      const px1 = Number(nx1);
      const py1 = Number(ny1);
      const px2 = Number(nx2);
      const py2 = Number(ny2);
      if ([px1, py1, px2, py2].some(Number.isNaN)) return;

      const newCorner1: [number, number] = [Math.min(px1, px2), Math.min(py1, py2)];
      const newCorner2: [number, number] = [Math.max(px1, px2), Math.max(py1, py2)];

      if (editingRoiId) {
        setSavedRois((prev) =>
          prev.map((r) => {
            if (r.id !== editingRoiId) return r;
            return {
              ...r,
              corner1: newCorner1,
              corner2: newCorner2,
              z1: nz1 !== "" ? Number(nz1) : r.z1,
              z2: nz2 !== "" ? Number(nz2) : r.z2,
            };
          }),
        );
        return;
      }

      setPendingRoi((prev) => {
        if (!prev) return prev;
        internalUpdate.current = true;
        return {
          corner1: newCorner1,
          corner2: newCorner2,
          z1: nz1 !== "" ? Number(nz1) : prev.z1,
          z2: nz2 !== "" ? Number(nz2) : prev.z2,
        };
      });
    },
    [editingRoiId, setSavedRois, setPendingRoi],
  );

  const onX1Change = (v: string) => { setX1(v); syncFieldsToPending(v, y1, x2, y2, z1, z2); };
  const onY1Change = (v: string) => { setY1(v); syncFieldsToPending(x1, v, x2, y2, z1, z2); };
  const onX2Change = (v: string) => { setX2(v); syncFieldsToPending(x1, y1, v, y2, z1, z2); };
  const onY2Change = (v: string) => { setY2(v); syncFieldsToPending(x1, y1, x2, v, z1, z2); };
  const onZ1Change = (v: string) => { setZ1(v); syncFieldsToPending(x1, y1, x2, y2, v, z2); };
  const onZ2Change = (v: string) => { setZ2(v); syncFieldsToPending(x1, y1, x2, y2, z1, v); };

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
    const nx1 = Number(x1);
    const ny1 = Number(y1);
    const nx2 = Number(x2);
    const ny2 = Number(y2);
    if ([nx1, ny1, nx2, ny2].some(Number.isNaN)) return;
    const nz1 = z1 !== "" ? Number(z1) : pendingRoi.z1;
    const nz2 = z2 !== "" ? Number(z2) : pendingRoi.z2;
    const raw = {
      corner1: [nx1, ny1] as [number, number],
      corner2: [nx2, ny2] as [number, number],
      z1: nz1,
      z2: nz2,
    };
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
    setX1(String(b.x1));
    setY1(String(b.y1));
    setX2(String(b.x2));
    setY2(String(b.y2));
    setZ1(String(b.z1));
    setZ2(String(b.z2));
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
    x1, y1, x2, y2, z1, z2,
    onX1Change, onY1Change, onX2Change, onY2Change, onZ1Change, onZ2Change,
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
