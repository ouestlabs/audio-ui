import type {
  EnvelopeController,
  EnvelopeSnapshot,
} from "@audio-ui/core/envelope";
import type { Nullable } from "@audio-ui/core/internal";
import * as React from "react";
import type { Root } from "./elements/root.js";

/** The points array and its indices stay in `state`; they don't become data attributes. */
export const STATE_ATTRIBUTES_MAPPING = {
  value: () => null,
};

export interface EnvelopeContextValue {
  /** Adds a point at `at` (normalized 0…1) and moves the roving tab stop to it. */
  addPoint: (at: { x: number; y: number }, event: MouseEvent) => void;
  /** The framework-free envelope behind every part: gestures, keys, adds, removes, bends. */
  controller: EnvelopeController;
  /** Roving tab stop among the points. */
  focusedIndex: number;
  /** Roving tab stop among the segments' handles. */
  focusedSegmentIndex: number;
  focusPoint: (index: number) => void;
  focusSegment: (index: number) => void;
  graphRef: React.RefObject<SVGSVGElement | null>;
  registerPoint: (index: number, node: Nullable<HTMLElement>) => void;
  registerSegment: (index: number, node: Nullable<HTMLElement>) => void;
  /** Removes a point and moves the roving tab stop to the one that takes its place. */
  removePoint: (index: number, event: MouseEvent | KeyboardEvent) => void;
  setFocusedIndex: (index: number) => void;
  setFocusedSegmentIndex: (index: number) => void;
  /** Everything a view draws the envelope from: points, drags, feedback signals. */
  snapshot: EnvelopeSnapshot;
  state: Root.State;
}

export const EnvelopeContext = React.createContext<EnvelopeContextValue | null>(
  null
);

export function useEnvelopeContext(part: string): EnvelopeContextValue {
  const context = React.use(EnvelopeContext);
  if (!context) {
    throw new Error(`Envelope.${part} must be used within Envelope.Root`);
  }
  return context;
}
