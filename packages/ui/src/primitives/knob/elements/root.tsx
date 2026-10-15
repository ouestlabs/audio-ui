import type { ParameterScaleProp } from "@audio-ui/core";
import {
  createKnobController,
  type KnobChangeEventDetails,
  type KnobCommitEventDetails,
  type KnobDragMode,
  STATE_ATTRIBUTES_MAPPING,
} from "@audio-ui/core/knob";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { useRender } from "../../internal/render.ts";
import { useLocale } from "../../internal/use-locale.ts";
import { KnobContext, type KnobContextValue } from "../context.ts";

/**
 * Groups all parts of the knob and owns its value. Dragging the `Control`,
 * turning the mouse wheel over it, the keyboard on the `Thumb`'s input, or a
 * double tap (reset) all report through `onValueChange` / `onValueCommitted`.
 * Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    anchor,
    className,
    defaultValue,
    disabled = false,
    dragMode = "circular",
    form,
    format,
    largeStep = 10,
    locale,
    max = 100,
    min = 0,
    name,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    scale = "linear",
    step = 1,
    style,
    value,
    ...elementProps
  } = componentProps;
  const resolvedLocale = useLocale(locale);

  const [controller] = React.useState(() => createKnobController());
  // Set on every render, before the snapshot is read, so it always shows the latest props.
  controller.setOptions({
    anchor,
    defaultValue,
    disabled,
    dragMode,
    format,
    largeStep,
    locale: resolvedLocale,
    max,
    min,
    onValueChange,
    onValueCommitted,
    scale,
    step,
    value,
  });
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const inputId = React.useId();
  const [labelId, setLabelId] = React.useState<string>();

  const state = React.useMemo<Root.State>(
    () => ({
      disabled: snapshot.disabled,
      dragging: snapshot.dragging,
      max: snapshot.max,
      min: snapshot.min,
      value: snapshot.value,
    }),
    [snapshot]
  );

  const context = React.useMemo<KnobContextValue>(
    () => ({
      controller,
      form,
      inputId,
      inputRef,
      labelId,
      name,
      setLabelId,
      snapshot,
      state,
    }),
    [controller, form, inputId, labelId, name, snapshot, state]
  );

  const element = useRender({
    defaultTagName: "div",
    props: { ...elementProps, ...resolveStyling(className, style, state) },
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });

  return <KnobContext value={context}>{element}</KnobContext>;
}

export namespace Root {
  export type State = {
    disabled: boolean;
    /** Whether a pointer is dragging the knob. */
    dragging: boolean;
    max: number;
    min: number;
    value: number;
  };

  /**
   * How pointer travel turns into value:
   * - `circular`: rotate around the center; the dial's sweep spans `min…max`.
   * - `revolution`: rotate around the center; one full turn spans `min…max`.
   * - `vertical`: drag up/down like a fader.
   */
  export type DragMode = KnobDragMode;

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails = KnobChangeEventDetails;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails = KnobCommitEventDetails;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Value the indicator arc grows from (e.g. `0` on a -1…1 pan knob). Defaults to `min`. */
    anchor?: number;
    /** Uncontrolled starting value, and the reset target of a double tap, an Alt + click and the Delete key. Defaults to the middle of the dial's travel. */
    defaultValue?: number;
    disabled?: boolean;
    /** @default "circular" */
    dragMode?: DragMode;
    /** Identifies the form that owns the knob's input, when rendered outside it. */
    form?: string;
    /** Formats the value for `Knob.Value` and the input's `aria-valuetext`. */
    format?: Intl.NumberFormatOptions;
    /** Step for Page Up/Page Down and Shift + Arrow keys. @default 10 */
    largeStep?: number;
    locale?: Intl.LocalesArgument;
    /** @default 100 */
    max?: number;
    /** @default 0 */
    min?: number;
    /** Identifies the field when a form is submitted. */
    name?: string;
    /** Fires on every change: drag, keyboard, wheel, reset and input changes. */
    onValueChange?: (value: number, eventDetails: ChangeEventDetails) => void;
    /** Fires when an interaction ends with a new value. */
    onValueCommitted?: (
      value: number,
      eventDetails: CommitEventDetails
    ) => void;
    /**
     * How the value maps onto the dial's travel: `linear`, `log` for
     * frequency, Q or ratios (needs a positive `min`), or your own
     * `{ toPosition, toValue }`. Away from linear, the keys and the wheel move
     * a share of the travel (1%, or 10% with Shift and Page keys) rather
     * than a `step`.
     * @default "linear"
     */
    scale?: Scale;
    /** @default 1 */
    step?: number;
    value?: number;
  }

  /** Maps a value onto the dial's travel, 0…1, and back. */
  export type Scale = ParameterScaleProp;
}
