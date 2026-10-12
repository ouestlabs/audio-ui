import type { Point } from "@audio-ui/core";
import type { Nullable } from "@audio-ui/core/internal";
import * as React from "react";
import type { Root } from "./elements/root";

export interface XYPadContextValue {
  actions: {
    /** Snap, clamp and propose a value; returns whether it was applied. */
    change: (next: Point, eventDetails: Root.ChangeEventDetails) => boolean;
    commit: (value: Point, eventDetails: Root.CommitEventDetails) => void;
    setDragging: (dragging: boolean) => void;
  };
  meta: {
    /** Formats both axes as one string, for `Value`. */
    formatPair: (x: number, y: number) => string;
    formatter: Intl.NumberFormat;
    inputRef: React.RefObject<HTMLInputElement | null>;
    labelId: string | undefined;
    /** Names the two native inputs for a form: `name.x` and `name.y`. */
    name: string | undefined;
    /** Value position, 0…1 from the left. */
    percentX: number;
    /** Value position, 0…1 from the bottom. */
    percentY: number;
    /** Where a double click, an Alt + click or the Delete key return to. */
    resetValue: Point;
    setLabelId: (id: string | undefined) => void;
    stepX: number;
    stepY: number;
    /** Latest displayed value, readable from event handlers. */
    valueRef: React.RefObject<Point>;
    wheelRef: (node: Nullable<HTMLElement>) => void;
  };
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
