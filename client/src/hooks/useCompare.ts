import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "compareRackets";
const MAX_COMPARE = 4;

export function useCompare() {
  const [compareIds, setCompareIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareIds));
  }, [compareIds]);

  const addToCompare = useCallback((slug: string) => {
    setCompareIds((prev) => {
      if (prev.includes(slug) || prev.length >= MAX_COMPARE) return prev;
      return [...prev, slug];
    });
  }, []);

  const removeFromCompare = useCallback((slug: string) => {
    setCompareIds((prev) => prev.filter((id) => id !== slug));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds([]);
  }, []);

  const isInCompare = useCallback(
    (slug: string) => compareIds.includes(slug),
    [compareIds],
  );

  return {
    compareIds,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    compareCount: compareIds.length,
    compareUrl: compareIds.length >= 2 ? `/compare/${compareIds.join(",")}` : null,
  };
}
