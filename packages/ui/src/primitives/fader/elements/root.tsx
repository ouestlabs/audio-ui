import {
  createFaderController,
  DEFAULT_MAX,
  DEFAULT_MIN,
  type FaderChangeEventDetails,
  type FaderCommitEventDetails,
} from "@audio-ui/core/fader";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { useLocale } from "../../internal/use-locale";
import {
  FADER_STATE_ATTRIBUTES,
  FaderContext,
  type FaderContextValue,
} from "../context";

/**
 * Groups all parts of the fader, with audio defaults (vertical, -60…+6) and
 * mouse-wheel stepping. While a pointer drags it, the
 * thumb follows the pointer even if a controlled `value` lags behind (a seek
 * bar driven by playback time, automation), reject a value with
 * `eventDetails.cancel()` instead. Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    anchor,
    className,
    defaultValue,
    disabled = false,
    format,
    largeStep = 10,
    locale,
    max = DEFAULT_MAX,
    min = DEFAULT_MIN,
    name,
    onValueChange,
    onValueCommitted,
    orientation = "vertical",
    ref,
    render,
    step = 1,
    style,
    value,
    ...elementProps
  } = componentProps;
  const resolvedLocale = useLocale(locale);

  const [controller] = React.useState(() => createFaderController());
  // Set on every render, before the snapshot is read, so it always shows the latest props.
  controller.setOptions({
    anchor,
    defaultValue,
    disabled,
    format,
    largeStep,
    locale: resolvedLocale,
    max,
    min,
    onValueChange,
    onValueCommitted,
    orientation,
    step,
    value,
  });
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  );

  const [labelId, setLabelId] = React.useState<string | undefined>();
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const thumbRef = React.useRef<HTMLElement | null>(null);

  const state = React.useMemo<Root.State>(
    () => ({
      disabled: snapshot.disabled,
      dragging: snapshot.dragging,
      orientation: snapshot.orientation,
      value: snapshot.value,
    }),
    [snapshot]
  );

  const contextValue = React.useMemo<FaderContextValue>(
    () => ({
      anchor: snapshot.anchor,
      controller,
      disabled: snapshot.disabled,
      formatted: snapshot.formatted,
      inputId,
      inputRef,
      labelId,
      largeStep: snapshot.largeStep,
      max: snapshot.max,
      min: snapshot.min,
      name,
      orientation: snapshot.orientation,
      setLabelId,
      state,
      step: snapshot.step,
      thumbRef,
      type: controller.type,
      value: snapshot.value,
    }),
    [controller, inputId, labelId, name, snapshot, state]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { "aria-labelledby": labelId, role: "group" },
      elementProps,
      resolveStyling(className, style, state)
    ),
    ref,
    render,
    state,
    stateAttributesMapping: FADER_STATE_ATTRIBUTES,
  });

  return <FaderContext value={contextValue}>{element}</FaderContext>;
}

export namespace Root {
  export interface State {
    disabled: boolean;
    /** Whether a pointer is moving the thumb. */
    dragging: boolean;
    orientation: "horizontal" | "vertical";
    /** The value as displayed. */
    value: number;
  }
  export type ChangeEventDetails = FaderChangeEventDetails;
  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type CommitEventDetails = FaderCommitEventDetails;
  export type CommitEventReason = CommitEventDetails["reason"];

  export interface Props
    extends Omit<PartProps<"div", State>, "defaultValue" | "onChange"> {
    /** Value the `Indicator` fills from, such as `0` on a -1…1 pan. Defaults to `min`. */
    anchor?: number;
    /** Uncontrolled starting value, and what a double click, an Alt + click or the Delete key return to; defaults to the midpoint of `min…max`. */
    defaultValue?: number;
    /** @default false */
    disabled?: boolean;
    /** How the value is written for `Value` and announced, e.g. `{ maximumFractionDigits: 1 }`. */
    format?: Intl.NumberFormatOptions;
    /** Step for Page Up/Page Down and Shift + arrow keys. @default 10 */
    largeStep?: number;
    /** Locale of the formatted value. Defaults to the browser's language. */
    locale?: Intl.LocalesArgument;
    /** @default 6 */
    max?: number;
    /** @default -60 */
    min?: number;
    /** Name of the native input, for a form. */
    name?: string;
    /** Fires on drag, track press, keyboard, wheel and form input changes. */
    onValueChange?: (value: number, eventDetails: ChangeEventDetails) => void;
    /** Fires when an interaction ends with a new value. */
    onValueCommitted?: (
      value: number,
      eventDetails: CommitEventDetails
    ) => void;
    /** @default "vertical" */
    orientation?: "horizontal" | "vertical";
    /** Granularity of every change. @default 1 */
    step?: number;
    value?: number;
  }
}
