import type { ChangeSource } from "@ui-sdk/core";

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
 * How a change came about, when its event says. The kernel reads it from
 * input it tracks, so the first interaction would report "programmatic"
 * without this. With no event, the kernel decides, and an agent's change
 * stays the agent's.
 */
export function sourceOf(event?: Event): ChangeSource | undefined {
  if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent) {
    return event.pointerType === "touch" || event.pointerType === "pen"
      ? event.pointerType
      : "mouse";
  }
  if (event instanceof MouseEvent) {
    return "mouse";
  }
  if (event instanceof KeyboardEvent) {
    return "keyboard";
  }
}
