import { createPadController, type PadOptions } from "@audio-ui/core/pad";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import {
  type OnEventDetails,
  PadContext,
  type PadContextValue,
  type PadState,
} from "../context.ts";

type Order = { disabledValues: string[]; values: string[] };

const NO_PADS: Order = { disabledValues: [], values: [] };

const sameOrder = (a: Order, b: Order) =>
  a.values.join("\n") === b.values.join("\n") &&
  a.disabledValues.join("\n") === b.disabledValues.join("\n");

/**
 * A grid of pads to strike: each one sounds while held, by pointer or from the
 * keyboard, and each pointer holds its own pad, so several can be played at
 * once on a touch screen. A strike is harder where a pen or screen presses
 * harder, or else toward the top of the pad.
 *
 * The pads are one tab stop: the left and right arrows walk them in reading
 * order, the up and down arrows by a row of `columns`. Renders a `<div>`
 * element.
 */
export function Root(componentProps: Root.Props) {
  const {
    activePads,
    className,
    columns = 4,
    disabled = false,
    onPadOff,
    onPadOn,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;

  const itemsRef = React.useRef(
    new Map<string, { disabled: boolean; node: HTMLElement }>()
  );
  const [order, setOrder] = React.useState(NO_PADS);

  const options: PadOptions = {
    activePads,
    columns,
    disabled,
    disabledValues: order.disabledValues,
    onPadOff,
    onPadOn,
    values: order.values,
  };
  const [controller] = React.useState(() => createPadController(options));
  // Set on every render, so the grid always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  // The pads' reading order is their order in the document, read once they are all mounted.
  React.useLayoutEffect(() => {
    const items = [...itemsRef.current].sort(([, a], [, b]) =>
      a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1
    );
    const next: Order = {
      disabledValues: items
        .filter(([, item]) => item.disabled)
        .map(([value]) => value),
      values: items.map(([value]) => value),
    };
    setOrder((previous) => (sameOrder(previous, next) ? previous : next));
  });

  const registerItem = React.useCallback(
    (value: string, node: HTMLElement | null, itemDisabled: boolean) => {
      if (node) {
        itemsRef.current.set(value, { disabled: itemDisabled, node });
      } else {
        itemsRef.current.delete(value);
      }
    },
    []
  );
  const focusPad = React.useCallback(
    (value: string, focusVisible = true) => {
      controller.focusPad(value);
      itemsRef.current
        .get(value)
        ?.node.focus({ focusVisible, preventScroll: true });
    },
    [controller]
  );

  const state = React.useMemo<Root.State>(
    () => ({ disabled: snapshot.disabled }),
    [snapshot.disabled]
  );

  const context = React.useMemo<PadContextValue>(
    () => ({
      controller,
      focusPad,
      meta: {
        active: snapshot.active,
        tabStop: snapshot.tabStop,
        velocities: snapshot.velocities,
      },
      registerItem,
      state,
    }),
    [controller, focusPad, registerItem, snapshot, state]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { role: "group" },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });

  return <PadContext value={context}>{element}</PadContext>;
}

export namespace Root {
  export type State = PadState;
  export type OnEventReason = OnEventDetails["reason"];
  export type OnEventDetails = import("../context.ts").OnEventDetails;
  export type OffEventReason = OffEventDetails["reason"];
  export type OffEventDetails = import("../context.ts").OffEventDetails;

  export interface Props extends PartProps<"div", State> {
    /** Pads lit from elsewhere, such as a sequencer or a MIDI input, on top of the ones held here. */
    activePads?: readonly string[];
    /** How many pads a row holds: what the up and down arrows move by. Lay the grid out to match. @default 4 */
    columns?: number;
    disabled?: boolean;
    /** Fires when a pad is released, loses focus while held, or is choked by another pad of its group (`reason: "choke"`). */
    onPadOff?: (value: string, eventDetails: OffEventDetails) => void;
    /** Fires when a pad is struck, with `eventDetails.velocity` from 0 to 1. `eventDetails.cancel()` keeps it silent. */
    onPadOn?: (value: string, eventDetails: OnEventDetails) => void;
  }
}
