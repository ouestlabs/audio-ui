"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import type { BuilderSearchParams } from "../lib/search-params";

type LockableParam = keyof BuilderSearchParams;

type LocksContextType = {
  isLocked: (param: LockableParam) => boolean;
  toggleLock: (param: LockableParam) => void;
};

const LocksContext = createContext<LocksContextType | undefined>(undefined);

export function LocksProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState<Set<LockableParam>>(new Set());

  function isLocked(param: LockableParam) {
    return locked.has(param);
  }

  function toggleLock(param: LockableParam) {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(param)) {
        next.delete(param);
      } else {
        next.add(param);
      }
      return next;
    });
  }

  return (
    <LocksContext.Provider value={{ isLocked, toggleLock }}>
      {children}
    </LocksContext.Provider>
  );
}

export function useLocks() {
  const ctx = useContext(LocksContext);
  if (!ctx) {
    throw new Error("useLocks must be used within LocksProvider");
  }
  return ctx;
}
