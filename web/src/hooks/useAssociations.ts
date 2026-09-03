// Wraps lib/associations.ts's IndexedDB read/write behind a hook — exposes
// the current associations list, upload metadata, and an upload handler to
// components. Mirrors useMemory.ts's conventions but backed by IndexedDB
// instead of localStorage, since the associations file needs its parsed
// rows persisted, not just a handful of remembered strings.

import { useCallback, useEffect, useState } from "react";
import {
  loadAssociationsRecord,
  saveAssociationsFile,
  type Association,
  type AssociationsRecord,
} from "../lib/associations";

export function useAssociations() {
  const [record, setRecord] = useState<AssociationsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAssociationsRecord().then((r) => {
      if (!cancelled) {
        setRecord(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const upload = useCallback(async (file: File) => {
    setError(null);
    try {
      const saved = await saveAssociationsFile(file);
      setRecord(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const associations: Association[] = record?.rows ?? [];

  return {
    associations,
    filename: record?.filename ?? null,
    uploadedAt: record?.uploadedAt ?? null,
    loading,
    error,
    upload,
  };
}
