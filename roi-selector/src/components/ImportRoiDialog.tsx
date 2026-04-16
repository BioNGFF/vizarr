import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { type RoiTableInfo, discoverRoiTables } from "../importRois";

interface ImportRoiDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (selectedTables: string[]) => void;
  sourceUrl: string;
}

export default function ImportRoiDialog({
  open,
  onClose,
  onImport,
  sourceUrl,
}: ImportRoiDialogProps) {
  const [tables, setTables] = useState<RoiTableInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sourceUrl) return;
    setLoading(true);
    setError(null);
    setTables([]);
    setSelected(new Set());

    discoverRoiTables(sourceUrl)
      .then((discovered) => {
        setTables(discovered);
        // Select all by default
        setSelected(new Set(discovered.map((t) => t.name)));
      })
      .catch((err) => {
        console.error("[ROI Import] Failed to discover ROI tables:", err);
        setError("Failed to read tables from zarr store.");
      })
      .finally(() => setLoading(false));
  }, [open, sourceUrl]);

  const handleToggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleImport = () => {
    onImport(Array.from(selected));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import ROIs from Zarr</DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {error && (
          <Typography color="error" sx={{ py: 1 }}>
            {error}
          </Typography>
        )}

        {!loading && !error && tables.length === 0 && (
          <Typography sx={{ py: 1, color: "text.secondary" }}>
            No ROI tables found in the zarr store.
          </Typography>
        )}

        {!loading &&
          !error &&
          tables.map((table) => (
            <FormControlLabel
              key={table.name}
              sx={{ display: "block" }}
              control={
                <Checkbox
                  checked={selected.has(table.name)}
                  onChange={() => handleToggle(table.name)}
                />
              }
              label={
                <Typography variant="body2">
                  <strong>{table.name}</strong> — {table.roiCount} ROI
                  {table.roiCount !== 1 ? "s" : ""}
                  {table.type ? ` (type: ${table.type})` : ""}
                </Typography>
              }
            />
          ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleImport}
          disabled={selected.size === 0 || loading}
          variant="contained"
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
