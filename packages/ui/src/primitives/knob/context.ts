import type { KnobController, KnobSnapshot } from "@audio-ui/core/knob";
import * as React from "react";
import type { Root } from "./elements/root.tsx";

export interface KnobContextValue {
  /** The framework-agnostic knob behind every part: gestures, keys, the wheel, typed values. */
  controller: KnobController;
  form: string | undefined;
  inputId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  labelId: string | undefined;
  name: string | undefined;
  setLabelId: (id: string | undefined) => void;
  /** Everything a view draws the knob from: value, angle, arc origin, formatting. */
  snapshot: KnobSnapshot;
  state: Root.State;
}

export const KnobContext = React.createContext<KnobContextValue | null>(null);

export function useKnobContext(part: string): KnobContextValue {
  const context = React.use(KnobContext);
  if (!context) {
    throw new Error(`Knob.${part} must be used within Knob.Root`);
  }
  return context;
}
