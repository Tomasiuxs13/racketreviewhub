import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "compareRackets";
const MAX_COMPARE = 3;

interface CompareContextType {
  compareIds: string[];
  addToCompare: (slug: string) => void;
  removeFromCompare: (slug: string) => void;
  clearCompare: () => void;
  isInCompare: (slug: string) => boolean;
  compareCount: number;
  compareUrl: string | null;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: React.ReactNode }) {
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

  const value = {
    compareIds,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    compareCount: compareIds.length,
    compareUrl: compareIds.length > 0 ? `/compare/${compareIds.join(",")}` : "/compare",
  };

  return (
    <CompareContext.Provider value={value} >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (context === undefined) {
    // Fallback for cases where it's used outside Provider (though we'll wrap App)
    console.warn("useCompare used outside of CompareProvider. This may cause sync issues.");
    // Return a dummy object if needed, or throw error.
    // Let's throw error to be strict.
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return context;
}
