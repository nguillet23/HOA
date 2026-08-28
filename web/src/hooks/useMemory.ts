// Mirrors src/handlers_memory.py, backed by localStorage instead of a
// server-side JSON file. Only remembers non-sensitive, re-enterable
// values — never the password (see mapping table: "stays purely
// client-side"), and never file selections (the browser's File API has no
// concept of "remember this path" the way a native OS picker does).

import { useCallback, useState } from "react";

const STORAGE_KEY = "budget-processor:last-session";

export interface RememberedValues {
  lastAssociation: string;
  lastNumber: string;
  lastMonth: string;
  lastYear: string;
  lastBudgetYear: string;
}

const EMPTY: RememberedValues = {
  lastAssociation: "",
  lastNumber: "",
  lastMonth: "",
  lastYear: "",
  lastBudgetYear: "",
};

function readStorage(): RememberedValues {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // Unavailable (private browsing, quota) or corrupt — remembering
    // last-used values is a convenience, not a requirement.
    return EMPTY;
  }
}

export function useMemory() {
  const [remembered] = useState<RememberedValues>(() => readStorage());

  const save = useCallback((values: RememberedValues) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // Best effort — see readStorage.
    }
  }, []);

  return { remembered, save };
}
