import * as React from "react";
import type { Nullable } from "../../utils";
import type { ParameterScale } from "../internal/parameter-scale";
import type { Root } from "./elements/root";

export interface KnobContextValue {
  actions: {
    /** Snap, clamp and propose a value; returns whether it was applied. */
    change: (next: number, eventDetails: Root.ChangeEventDetails) => boolean;
    commit: (value: number, eventDetails: Root.CommitEventDetails) => void;
    setDragging: (dragging: boolean) => void;
  };
  meta: {
    /** Indicator arc origin, 0…1 along the sweep. */
    anchorPercent: number;
    /** Rotation in degrees, clockwise from 12 o'clock. */
    angle: number;
    dragMode: Root.DragMode;
    form: string | undefined;
    formatter: Intl.NumberFormat;
    inputId: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    labelId: string | undefined;
    largeStep: number;
    name: string | undefined;
    /** Value position, 0…1 along the sweep. */
    percent: number;
    resetValue: number;
    /** How the value maps onto the dial's travel. */
    scale: ParameterScale;
    setLabelId: (id: string | undefined) => void;
    step: number;
    /** Latest displayed value, readable from event handlers. */
    valueRef: React.RefObject<number>;
    wheelRef: (node: Nullable<HTMLElement>) => void;
  };
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
