"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

interface ShowPartsValue {
  shown: boolean;
  toggle: () => void;
}

const ShowPartsContext = React.createContext<ShowPartsValue | null>(null);

function useShowParts(): ShowPartsValue {
  const value = React.use(ShowPartsContext);
  if (!value) {
    throw new Error("ShowParts parts must be used within ShowPartsProvider");
  }
  return value;
}

/** Holds the switch: the toggle in the preview's header and the area it outlines are both in it. */
export function ShowPartsProvider({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = React.useState(false);
  const toggle = React.useCallback(() => setShown((on) => !on), []);
  const value = React.useMemo(() => ({ shown, toggle }), [shown, toggle]);
  return (
    <ShowPartsContext.Provider value={value}>
      {children}
    </ShowPartsContext.Provider>
  );
}

/** The switch, in the preview's header. */
export function ShowPartsToggle() {
  const { shown, toggle } = useShowParts();
  return (
    <Button
      aria-pressed={shown}
      onClick={toggle}
      size="default"
      variant="outline"
    >
      Show parts
    </Button>
  );
}

/** The component, with every element of its anatomy outlined while the switch is on. */
export function ShowPartsArea({ children }: { children: React.ReactNode }) {
  const { shown } = useShowParts();
  return (
    // display: contents keeps the component laid out as it was without this wrapper.
    <div
      className={
        shown
          ? "contents **:data-slot:outline-1 **:data-slot:outline-dashed **:data-slot:outline-site-muted-foreground/60"
          : "contents"
      }
    >
      {children}
    </div>
  );
}
