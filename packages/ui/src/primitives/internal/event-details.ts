/**
 * Change/commit event details for interactions the underlying controls don't
 * handle themselves (e.g. wheel), so every input reaches consumers through the
 * same `eventDetails` contract: `reason`, `event`, `cancel()`.
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

export interface CommitEventDetails<Reason extends string, E extends Event> {
  event: E;
  reason: Reason;
}

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
