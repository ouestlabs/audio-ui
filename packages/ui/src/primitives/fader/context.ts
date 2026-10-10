import * as React from "react";
import type { Nullable } from "../../utils";

export interface FaderContextValue {
  anchor: number | undefined;
  disabled: boolean;
  max: number;
  min: number;
  orientation: "horizontal" | "vertical";
  /** The value as displayed. */
  /** Returns to the default value, reporting a `"reset"` change and commit. */
  reset: (event: KeyboardEvent | MouseEvent | PointerEvent) => void;
  value: number;
  wheelRef: (node: Nullable<HTMLElement>) => void;
}

export const FaderContext = React.createContext<FaderContextValue | null>(null);

export function useFaderContext(part: string): FaderContextValue {
  const context = React.use(FaderContext);
  if (!context) {
    throw new Error(`Fader.${part} must be used within Fader.Root`);
  }
  return context;
}
