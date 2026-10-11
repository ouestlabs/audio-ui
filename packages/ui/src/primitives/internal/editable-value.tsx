import * as React from "react";

/**
 * The number a typed text means: "-6", "-6 dB", "12,5" or "50%". Anything
 * without a number in front is nothing.
 */
export function parseTypedNumber(text: string): number | null {
  const parsed = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A readout you can type into: a double click, or Enter or F2 while it has
 * focus, swaps it for a text field holding the value. Enter (or leaving the
 * field) commits what was typed, Escape drops it. `commit` receives the
 * typed number and the event; a text with no number in it is dropped.
 */
export function useEditableValue({
  commit,
  disabled,
  editable,
}: {
  commit: (typed: number, event: Event) => void;
  disabled: boolean;
  editable: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const readoutRef = React.useRef<HTMLElement | null>(null);

  const finish = React.useCallback(
    (text: string | null, event: Event) => {
      setEditing(false);
      readoutRef.current?.focus({ preventScroll: true });
      const typed = text === null ? null : parseTypedNumber(text);
      if (typed !== null) {
        commit(typed, event);
      }
    },
    [commit]
  );

  const active = editable && !disabled;
  const readoutProps = active
    ? {
        "aria-keyshortcuts": "Enter",
        "data-editing": editing ? "" : undefined,
        // A readout inside a thumb or a control must not also reset or drag it.
        onDoubleClick: (event: React.MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          setEditing(true);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (
            event.target === event.currentTarget &&
            (event.key === "Enter" || event.key === "F2")
          ) {
            event.preventDefault();
            setEditing(true);
          }
        },
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
          event.stopPropagation();
        },
        tabIndex: 0,
      }
    : {};

  return {
    editing: editing && active,
    finish,
    readoutProps,
    readoutRef,
  };
}

/** The text field of an editable readout: selected on mount, so typing replaces the value. */
export function ValueInput({
  "aria-label": ariaLabel,
  finish,
  initial,
}: {
  "aria-label": string | undefined;
  finish: (text: string | null, event: Event) => void;
  initial: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const done = React.useRef(false);
  const settle = React.useCallback(
    (text: string | null, event: Event) => {
      if (!done.current) {
        done.current = true;
        finish(text, event);
      }
    },
    [finish]
  );
  // Opened by a deliberate gesture on the readout: take the focus.
  React.useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }, []);
  const handleBlur = React.useCallback(
    (event: React.FocusEvent<HTMLInputElement>) =>
      settle(event.currentTarget.value, event.nativeEvent),
    [settle]
  );
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        settle(event.currentTarget.value, event.nativeEvent);
      } else if (event.key === "Escape") {
        event.preventDefault();
        settle(null, event.nativeEvent);
      }
    },
    [settle]
  );
  return (
    <input
      aria-label={ariaLabel}
      defaultValue={initial}
      inputMode="decimal"
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      ref={inputRef}
      size={Math.max(initial.length, 3)}
      style={{ font: "inherit", textAlign: "inherit" }}
      type="text"
    />
  );
}
