import type { Point } from "@audio-ui/core";
import {
  createXYPadController,
  STATE_ATTRIBUTES_MAPPING,
  type XYPadChangeEventDetails,
  type XYPadCommitEventDetails,
} from "@audio-ui/core/xypad";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useLocale } from "../../internal/use-locale.ts";
import { XYPadContext, type XYPadContextValue } from "../context.ts";

/**
 * Groups all parts of the pad and owns its two-dimensional value. Exposes the
 * value position as CSS variables for crosshairs and guides:
 * `--xy-pad-x` (from the left) and `--xy-pad-y` (from the top), as percentages.
 * Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    className,
    defaultValue,
    disabled = false,
    format,
    locale,
    maxX = 100,
    maxY = 100,
    minX = 0,
    minY = 0,
    name,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    stepX = 1,
    stepY = 1,
    style,
    value,
    ...elementProps
  } = componentProps;
  const resolvedLocale = useLocale(locale);

  const [controller] = React.useState(() => createXYPadController());
  // Set on every render, before the snapshot is read, so it always shows the latest props.
  controller.setOptions({
    defaultValue,
    disabled,
    format,
    locale: resolvedLocale,
    maxX,
    maxY,
    minX,
    minY,
    onValueChange,
    onValueCommitted,
    stepX,
    stepY,
    value,
  });
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [labelId, setLabelId] = React.useState<string>();

  const state = React.useMemo<Root.State>(
    () => ({
      disabled: snapshot.disabled,
      dragging: snapshot.dragging,
      maxX: snapshot.maxX,
      maxY: snapshot.maxY,
      minX: snapshot.minX,
      minY: snapshot.minY,
      value: snapshot.value,
    }),
    [snapshot]
  );

  const context = React.useMemo<XYPadContextValue>(
    () => ({
      controller,
      inputRef,
      labelId,
      name,
      setLabelId,
      snapshot,
      state,
    }),
    [controller, labelId, name, snapshot, state]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        style: {
          "--xy-pad-x": `${snapshot.percentX * 100}%`,
          "--xy-pad-y": `${100 - snapshot.percentY * 100}%`,
        } as React.CSSProperties,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });

  return <XYPadContext value={context}>{element}</XYPadContext>;
}

export namespace Root {
  export type State = {
    disabled: boolean;
    /** Whether a pointer is dragging on the pad. */
    dragging: boolean;
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
    value: Point;
  };

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails = XYPadChangeEventDetails;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails = XYPadCommitEventDetails;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting value. Defaults to the center of the pad. */
    defaultValue?: Point;
    disabled?: boolean;
    /** Formats each axis for `XYPad.Value` and the inputs' `aria-valuetext`. */
    format?: Intl.NumberFormatOptions;
    locale?: Intl.LocalesArgument;
    /** @default 100 */
    maxX?: number;
    /** @default 100 */
    maxY?: number;
    /** @default 0 */
    minX?: number;
    /** @default 0 */
    minY?: number;
    /** Names the pad for a form: its two inputs submit as `name.x` and `name.y`. */
    name?: string;
    /** Fires on every change: press, drag, keyboard, wheel and input changes. */
    onValueChange?: (value: Point, eventDetails: ChangeEventDetails) => void;
    /** Fires when an interaction ends with a new value. */
    onValueCommitted?: (value: Point, eventDetails: CommitEventDetails) => void;
    /** @default 1 */
    stepX?: number;
    /** @default 1 */
    stepY?: number;
    value?: Point;
  }
}
