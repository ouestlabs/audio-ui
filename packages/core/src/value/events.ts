/**
 * What a change reports: why it happened (`reason`), the event behind it, the
 * element that triggered it, and `cancel()` to refuse the change. Every input
 * of every controller, the wheel included, reaches its callbacks in this one
 * shape.
 */
export interface ChangeEventDetails<Reason extends string, E extends Event> {
  allowPropagation: () => void;
  cancel: () => void;
  event: E;
  readonly isCanceled: boolean;
  readonly isPropagationAllowed: boolean;
  reason: Reason;
  trigger: Element | undefined;
}

/** What a commit reports once a gesture ends: why it happened (`reason`) and the event behind it. */
export interface CommitEventDetails<Reason extends string, E extends Event> {
  event: E;
  reason: Reason;
}

/** The details of a change for `reason` and `event`, with `cancel()` to refuse it and `allowPropagation()` to let the event go on. */
export function createChangeEventDetails<
  Reason extends string,
  E extends Event,
>(reason: Reason, event: E): ChangeEventDetails<Reason, E> {
  let canceled = false;
  let propagationAllowed = false;
  return {
    allowPropagation: () => {
      propagationAllowed = true;
    },
    cancel: () => {
      canceled = true;
    },
    event,
    get isCanceled() {
      return canceled;
    },
    get isPropagationAllowed() {
      return propagationAllowed;
    },
    reason,
    trigger:
      event.currentTarget instanceof Element ? event.currentTarget : undefined,
  };
}
