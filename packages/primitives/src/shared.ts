import {
  type ChangeSource,
  createChange,
  dispatch,
  type PrimitiveContext,
} from "@ui-sdk/core";

/** A boolean as a data attribute: present and empty, or absent. */
export const flag = (on: boolean) => (on ? "" : undefined);

/** What a change reports to `onValueChange`, beside the value. */
export interface ChangeDetails {
  cancel: () => void;
  event?: Event;
  /** The point or segment that moved, for a control that has several. */
  index?: number;
  reason: string;
  source?: string;
}

/** What a commit reports to `onValueCommitted`, beside the value. */
export interface CommitDetails {
  event?: Event;
  index?: number;
  reason: string;
}

/** How a native input is hidden while it keeps the focus, the keys and the name. */
export const VISUALLY_HIDDEN = {
  border: "0",
  "clip-path": "inset(50%)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: "0",
  position: "absolute",
  "white-space": "nowrap",
  width: "1px",
};

/**
 * How a change of ours came about, when its event says. UI SDK reads it from
 * its own reasons, which ours aren't, or from input it tracks once asked, so
 * the first interaction would report "programmatic". Without such an event,
 * UI SDK decides, and an agent's change stays the agent's.
 */
export function sourceOf(event?: Event): ChangeSource | undefined {
  if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent) {
    return event.pointerType === "touch" || event.pointerType === "pen"
      ? event.pointerType
      : "mouse";
  }
  if (event instanceof KeyboardEvent) {
    return "keyboard";
  }
  if (event instanceof WheelEvent) {
    return "mouse";
  }
}

/** What a controller needs for the kernel to hold its value. */
interface Controller<Value, Snapshot> {
  getSnapshot: () => Snapshot;
  setOptions: (options: never) => void;
  subscribe: (listener: () => void) => () => void;
  /** Only to tell the type of its value. */
  readonly value?: Value;
}

/** The state of a primitive that holds one value in a controller. */
export interface HeldState<Value, Snapshot> {
  value: Value;
  view: Snapshot;
}

/**
 * Connects one of our controllers to the kernel: the controller always works
 * controlled, the kernel's state holds the value, a change goes through
 * `createChange` so it reports its source and an app or an agent can refuse
 * it, and a commit is dispatched under our name, `onValueCommitted`.
 */
export function connectController<Value, Snapshot>(
  context: PrimitiveContext<any, HeldState<Value, Snapshot> & object, any>,
  controller: Controller<Value, Snapshot>,
  /** Fills in what the controller needs of the options the app left out. */
  adjust: (options: Record<string, unknown>) => Record<string, unknown> = (
    options
  ) => options
) {
  const change = createChange(context);
  let configuredValue: Value | undefined;
  const configure = () => {
    const options = context.options() as Record<string, unknown>;
    configuredValue = context.store.get().value;
    (controller.setOptions as (options: unknown) => void)({
      ...adjust(options),
      onValueChange: (
        value: Value,
        details: {
          cancel: () => void;
          event?: Event;
          index?: number;
          reason: string;
        }
      ) => {
        const source = sourceOf(details.event);
        const accepted = change("value", value, {
          event: details.event,
          // Which point or segment moved, for a control with several.
          ...(details.index === undefined ? {} : { index: details.index }),
          reason: details.reason,
          ...(source ? { source } : {}),
        } as never);
        if (!accepted) {
          details.cancel();
        }
      },
      onValueCommitted: (
        value: Value,
        details: { event?: Event; index?: number; reason: string }
      ) => {
        dispatch(context, "onValueCommitted", value, {
          event: details.event,
          ...(details.index === undefined ? {} : { index: details.index }),
          reason: details.reason,
        });
      },
      value: configuredValue,
    });
    // The controller tells no one of new options: the parts read its snapshot here.
    context.store.set({ view: controller.getSnapshot() } as never);
  };
  configure();
  context.onOptions(configure);
  context.onDestroy(
    context.store.subscribe(() => {
      if (context.store.get().value !== configuredValue) {
        configure();
      }
    })
  );
  context.onDestroy(
    controller.subscribe(() =>
      context.store.set({ view: controller.getSnapshot() } as never)
    )
  );
}
