import {
  type ArcState,
  type ChangeDetails,
  DEFAULT_ARC_STROKE_WIDTH,
  type KnobPrimitiveOptions,
  type KnobPublicState,
  knob,
} from "@audio-ui/primitives/knob";
import { createParts } from "@ui-sdk/react/primitive";
import {
  type ComponentProps,
  type ComponentType,
  createContext,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const noop = () => undefined;

/** The parts that are native inputs: `input`, `rulerInput`, `inputX`. */
const INPUT_PART = /input[xy]?$/i;

/**
 * The kernel listens to the native inputs itself, so React sees a `value` and
 * no `onChange`: this tells it the field is read elsewhere, and keeps it from
 * warning of one.
 */
function quietInputs<Parts extends object>(source: Parts): Parts {
  const quiet: Record<string, unknown> = {};
  for (const [name, Part] of Object.entries(source)) {
    const Component = Part as ComponentType<{ onChange?: () => void }>;
    quiet[name] = INPUT_PART.test(name)
      ? (props: object) => <Component {...props} onChange={noop} />
      : Part;
  }
  return quiet as Parts;
}

/** Which element each part is. */
const parts = quietInputs(
  createParts(knob, {
    control: "div",
    indicator: "svg",
    input: "input",
    label: "div",
    mark: "div",
    root: "div",
    thumb: "div",
    track: "svg",
    value: "output",
  })
);

/**
 * What a provider gives every knob below it. UI SDK has no such thing, so
 * each framework writes its own.
 */
type Defaults = Pick<KnobPrimitiveOptions, "dragMode">;
const KnobDefaults = createContext<Defaults>({});

function Provider({
  children,
  ...defaults
}: Defaults & { children: ReactNode }) {
  return <KnobDefaults value={defaults}>{children}</KnobDefaults>;
}

function KnobRoot(props: ComponentProps<typeof parts.Root>) {
  const defaults = use(KnobDefaults);
  // A prop left undefined by a wrapper does not hide what the provider gives.
  return (
    <parts.Root {...props} dragMode={props.dragMode ?? defaults.dragMode} />
  );
}

/** An arc in the part's own state, written as its child so the server renders it. */
function arc(strokeWidth: number) {
  return ({ arc: d }: ArcState) =>
    d ? (
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    ) : null;
}

function Track(props: ComponentProps<typeof parts.Track>) {
  return (
    <parts.Track {...props}>
      {arc(props.strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH)}
    </parts.Track>
  );
}

function Indicator(props: ComponentProps<typeof parts.Indicator>) {
  return (
    <parts.Indicator {...props}>
      {arc(props.strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH)}
    </parts.Indicator>
  );
}

type ThumbProps = ComponentProps<typeof parts.Thumb> & {
  getAriaValueText?: (formatted: string, value: number) => string;
};

const childrenOf = (
  children: ThumbProps["children"],
  state: KnobPublicState
): ReactNode => (typeof children === "function" ? children(state) : children);

/** The thumb, with the native input that carries the knob's name inside it. */
function KnobThumb({
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
      ?.closest('[data-slot="knob"]')
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
    (state: KnobPublicState) => {
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

/** The published knob's types, by part, so code written against it compiles. */
export namespace Knob {
  export namespace Root {
    export type Props = ComponentProps<typeof parts.Root>;
    export type State = KnobPublicState;
    export type ChangeEventDetails = ChangeDetails;
    export type CommitEventDetails = Parameters<
      NonNullable<KnobPrimitiveOptions["onValueCommitted"]>
    >[1];
  }
  export namespace Control {
    export type Props = ComponentProps<typeof parts.Control>;
    export type State = KnobPublicState;
  }
  export namespace Thumb {
    export type Props = ThumbProps;
    export type State = KnobPublicState;
  }
}

export const Knob = {
  Control: parts.Control,
  Indicator,
  Label: parts.Label,
  Mark: parts.Mark,
  Provider,
  Root: KnobRoot,
  Thumb: KnobThumb,
  Track,
  Value,
};
