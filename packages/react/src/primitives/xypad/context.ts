import type { XYPadController, XYPadSnapshot } from "@audio-ui/core/xypad";
import * as React from "react";
import type { Root } from "./elements/root.tsx";

export interface XYPadContextValue {
  /** The framework-agnostic pad behind every part: gestures, keys, the wheel, typed values. */
  controller: XYPadController;
  inputRef: React.RefObject<HTMLInputElement | null>;
  labelId: string | undefined;
  /** Names the two native inputs for a form: `name.x` and `name.y`. */
  name: string | undefined;
  setLabelId: (id: string | undefined) => void;
  /** Everything a view draws the pad from: point, positions, formatting. */
  snapshot: XYPadSnapshot;
  state: Root.State;
}

export const XYPadContext = React.createContext<XYPadContextValue | null>(null);

export function useXYPadContext(part: string): XYPadContextValue {
  const context = React.use(XYPadContext);
  if (!context) {
    throw new Error(`XYPad.${part} must be used within XYPad.Root`);
  }
  return context;
}
