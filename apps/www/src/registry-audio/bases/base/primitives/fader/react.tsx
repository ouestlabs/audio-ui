import type { FaderPublicState } from "@audio-ui/primitives/fader";
import { fader } from "@audio-ui/primitives/fader";
import { createParts } from "@ui-sdk/react/primitive";
import {
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/** Which element each part is. */
const parts = createParts(fader, {
  control: "div",
  indicator: "div",
  input: "input",
  label: "div",
  mark: "div",
  root: "div",
  thumb: "div",
  track: "div",
  value: "output",
});

type ThumbProps = ComponentProps<typeof parts.Thumb> & {
  getAriaValueText?: (
    formatted: string,
    value: number,
    index: number
  ) => string;
};

const childrenOf = (
  children: ThumbProps["children"],
  state: FaderPublicState
): ReactNode => (typeof children === "function" ? children(state) : children);

/** The thumb, with the native input that carries the fader's name inside it. */
function FaderThumb({
  "aria-label": label,
  children,
  getAriaValueText,
  ...props
}: ThumbProps) {
  return (
    <parts.Thumb {...props}>
      {(state) => (
        <>
          {childrenOf(children, state)}
          <parts.Input aria-label={label} getAriaValueText={getAriaValueText} />
        </>
      )}
    </parts.Thumb>
  );
}

/** The number a typed text means: "-6", "-6 dB" or "12,5". */
const typedNumber = (text: string) => {
  const parsed = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

/** The text field of an editable readout: selected on mount, so typing replaces the value. */
function ValueInput({
  finish,
  initial,
  label,
}: {
  finish: (text: string | null) => void;
  initial: string;
  label: string | undefined;
}) {
  const input = useRef<HTMLInputElement>(null);
  const done = useRef<boolean>(false);
  const settle = useCallback(
    (text: string | null) => {
      if (!done.current) {
        done.current = true;
        finish(text);
      }
    },
    [finish]
  );
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, []);
  const blur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => settle(event.currentTarget.value),
    [settle]
  );
  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        settle(event.currentTarget.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        settle(null);
      }
    },
    [settle]
  );
  return (
    <input
      aria-label={label}
      defaultValue={initial}
      inputMode="decimal"
      onBlur={blur}
      onKeyDown={keyDown}
      ref={input}
      size={Math.max(initial.length, 3)}
      style={{ font: "inherit", textAlign: "inherit" }}
      type="text"
    />
  );
}

type ValueProps = ComponentProps<typeof parts.Value> & {
  /** Lets you type the value: a double click on the readout, or Enter or F2 while it has focus. */
  editable?: boolean;
};

function Value({ children, editable = false, ...props }: ValueProps) {
  const [editing, setEditing] = useState(false);
  const readout = useRef<HTMLOutputElement | null>(null);
  const finish = useCallback((text: string | null) => {
    setEditing(false);
    readout.current?.focus({ preventScroll: true });
    const typed = text === null ? null : typedNumber(text);
    const input = readout.current
      ?.closest('[data-slot="fader"]')
      ?.querySelector<HTMLInputElement>('input[type="range"]');
    if (typed !== null && input) {
      // The native range input is where the control takes a typed value from.
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, String(typed));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, []);
  const open = () => {
    if (!readout.current?.closest("[data-disabled]")) {
      setEditing(true);
    }
  };
  const handlers = editable
    ? {
        "aria-keyshortcuts": "Enter",
        "data-editing": editing ? "" : undefined,
        // A readout inside a thumb or a control must not also reset or drag it.
        onDoubleClick: (event: MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          open();
        },
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          if (
            event.target === event.currentTarget &&
            (event.key === "Enter" || event.key === "F2")
          ) {
            event.preventDefault();
            open();
          }
        },
        onPointerDown: (event: PointerEvent<HTMLElement>) =>
          event.stopPropagation(),
        tabIndex: 0,
      }
    : {};
  const label = props["aria-label"];
  const content = useCallback(
    (state: FaderPublicState) => {
      if (editing) {
        return (
          <ValueInput finish={finish} initial={state.formatted} label={label} />
        );
      }
      if (typeof children === "function") {
        return children(state);
      }
      return children ?? state.formatted;
    },
    [children, editing, finish, label]
  );
  return (
    <parts.Value {...props} {...handlers} ref={readout}>
      {content}
    </parts.Value>
  );
}

export const Fader = {
  Control: parts.Control,
  Indicator: parts.Indicator,
  Label: parts.Label,
  Mark: parts.Mark,
  Root: parts.Root,
  Thumb: FaderThumb,
  Track: parts.Track,
  Value,
};
