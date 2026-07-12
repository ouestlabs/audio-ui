import type { Nullable, Point, Procedure } from "@audio-ui/utils";
import { clamp, panic } from "@audio-ui/utils";
import * as React from "react";
import { useKeyboardNavigation } from "../hooks/interactions/use-keyboard-navigation";
import { useCallbackRef } from "../hooks/use-callback-ref";
import { getDataAttributes } from "./internal/data-attributes";

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const KEY_COLOR_PATTERN: Array<"white" | "black"> = [
  "white",
  "black",
  "white",
  "black",
  "white",
  "white",
  "black",
  "white",
  "black",
  "white",
  "black",
  "white",
];
const BLACK_KEY_WIDTH_RATIO = 0.65;
/** Black keys only cover the upper portion of the keyboard's height; hits below this fall through to white keys. */
const BLACK_KEY_HEIGHT_RATIO = 0.6;

function getNoteName(note: number): string {
  const name = NOTE_NAMES[((note % 12) + 12) % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${name}${octave}`;
}

interface KeyLayoutEntry {
  color: "white" | "black";
  leftPercent: number;
  note: number;
  widthPercent: number;
}

function computeKeyLayout(
  startNote: number,
  endNote: number
): KeyLayoutEntry[] {
  const notes: number[] = [];
  for (let note = startNote; note <= endNote; note += 1) {
    notes.push(note);
  }
  const colors = notes.map(
    (note) => KEY_COLOR_PATTERN[((note % 12) + 12) % 12] ?? "white"
  );
  const whiteCount = colors.filter((color) => color === "white").length;
  const whiteWidthPercent = 100 / Math.max(whiteCount, 1);
  const blackWidthPercent = whiteWidthPercent * BLACK_KEY_WIDTH_RATIO;

  let whiteIndex = 0;
  const layout: KeyLayoutEntry[] = [];
  for (const [i, note] of notes.entries()) {
    const color = colors[i] ?? "white";
    if (color === "white") {
      layout.push({
        color,
        leftPercent: whiteIndex * whiteWidthPercent,
        note,
        widthPercent: whiteWidthPercent,
      });
      whiteIndex += 1;
    } else {
      const boundary = whiteIndex * whiteWidthPercent;
      layout.push({
        color,
        leftPercent: boundary - blackWidthPercent / 2,
        note,
        widthPercent: blackWidthPercent,
      });
    }
  }
  return layout;
}

/** Which key (by layout index) a viewport point lands on. Black keys sit on top and are only hit in the upper portion of the keyboard's height. */
function getKeyIndexFromPoint(
  point: Point,
  rect: DOMRect,
  layout: KeyLayoutEntry[]
): number | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const xPercent = ((point.x - rect.left) / rect.width) * 100;
  const yFraction = (point.y - rect.top) / rect.height;

  if (yFraction < BLACK_KEY_HEIGHT_RATIO) {
    for (const [index, entry] of layout.entries()) {
      if (
        entry.color === "black" &&
        xPercent >= entry.leftPercent &&
        xPercent < entry.leftPercent + entry.widthPercent
      ) {
        return index;
      }
    }
  }

  for (const [index, entry] of layout.entries()) {
    if (
      entry.color === "white" &&
      xPercent >= entry.leftPercent &&
      xPercent < entry.leftPercent + entry.widthPercent
    ) {
      return index;
    }
  }

  return null;
}

export namespace Piano {
  interface ConfigContextValue {
    ariaLabel?: string;
    ariaLabelledBy?: string;
    disabled: boolean;
    elementId: string;
    focusKey: (index: number) => void;
    keyLayout: KeyLayoutEntry[];
    pointerHandlers: {
      onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    };
    registerKey: (index: number, node: Nullable<HTMLElement>) => void;
    setFocusedIndex: Procedure<number>;
    shouldPreventFocusRef: React.RefObject<boolean>;
    tapKey: (index: number) => void;
    trackRef: React.RefObject<Nullable<HTMLDivElement>>;
  }

  /** Split from config: changes every note on/off, so only components that render live pressed state subscribe to it. */
  interface ValueContextValue {
    activeNoteSet: Set<number>;
    focusedIndex: number;
  }

  const ConfigContext = React.createContext<ConfigContextValue | null>(null);
  const ValueContext = React.createContext<ValueContextValue | null>(null);
  const KeyIndexContext = React.createContext<Nullable<number>>(null);

  function useConfigContext() {
    const context = React.useContext(ConfigContext);
    if (!context) {
      panic("Piano components must be used within Piano.Root");
    }
    return context;
  }

  function useValueContext() {
    const context = React.useContext(ValueContext);
    if (!context) {
      panic("Piano components must be used within Piano.Root");
    }
    return context;
  }

  function useKeyIndex() {
    const index = React.useContext(KeyIndexContext);
    if (index === null) {
      panic("Piano key parts must be used within Piano.Key");
    }
    return index;
  }

  export interface RootProps
    extends Omit<React.ComponentProps<"div">, "onChange"> {
    /** Notes highlighted from outside pointer interaction (external MIDI input, a sequencer). Merged with pointer-pressed notes for display. */
    activeNotes?: number[];
    "aria-label"?: string;
    "aria-labelledby"?: string;
    disabled?: boolean;
    endNote?: number;
    onNoteOff?: Procedure<number>;
    onNoteOn?: Procedure<number>;
    startNote?: number;
  }

  export function Root({
    startNote = 48,
    endNote = 72,
    disabled = false,
    activeNotes,
    onNoteOn,
    onNoteOff,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    id,
    className,
    children,
    ...props
  }: RootProps) {
    const pianoId = React.useId();
    const trackRef = React.useRef<HTMLDivElement>(null);
    const keyElementsRef = React.useRef(new Map<number, HTMLElement>());
    const pointerKeysRef = React.useRef(new Map<number, number>());
    const shouldPreventFocusRef = React.useRef(false);
    const [focusedIndex, setFocusedIndex] = React.useState(0);
    const [pressedNotes, setPressedNotes] = React.useState<Set<number>>(
      () => new Set()
    );

    const keyLayout = React.useMemo(
      () => computeKeyLayout(startNote, endNote),
      [startNote, endNote]
    );

    const onNoteOnRef = useCallbackRef(onNoteOn);
    const onNoteOffRef = useCallbackRef(onNoteOff);

    const noteOn = React.useCallback(
      (note: number) => {
        if (disabled) {
          return;
        }
        setPressedNotes((prev) => {
          if (prev.has(note)) {
            return prev;
          }
          const next = new Set(prev);
          next.add(note);
          return next;
        });
        onNoteOnRef(note);
      },
      [disabled, onNoteOnRef]
    );

    const noteOff = React.useCallback(
      (note: number) => {
        setPressedNotes((prev) => {
          if (!prev.has(note)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(note);
          return next;
        });
        onNoteOffRef(note);
      },
      [onNoteOffRef]
    );

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) {
          return;
        }
        const track = trackRef.current;
        if (!track) {
          return;
        }
        const rect = track.getBoundingClientRect();
        const index = getKeyIndexFromPoint(
          { x: e.clientX, y: e.clientY },
          rect,
          keyLayout
        );
        if (index === null) {
          return;
        }

        e.preventDefault();
        track.setPointerCapture(e.pointerId);
        pointerKeysRef.current.set(e.pointerId, index);

        shouldPreventFocusRef.current = true;
        setFocusedIndex(index);
        keyElementsRef.current.get(index)?.focus();

        const entry = keyLayout[index];
        if (entry) {
          noteOn(entry.note);
        }
      },
      [disabled, keyLayout, noteOn]
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const currentIndex = pointerKeysRef.current.get(e.pointerId);
        if (currentIndex === undefined) {
          return;
        }
        const track = trackRef.current;
        if (!track) {
          return;
        }
        const rect = track.getBoundingClientRect();
        const nextIndex = getKeyIndexFromPoint(
          { x: e.clientX, y: e.clientY },
          rect,
          keyLayout
        );
        if (nextIndex === null || nextIndex === currentIndex) {
          return;
        }

        const previousEntry = keyLayout[currentIndex];
        const nextEntry = keyLayout[nextIndex];
        if (previousEntry) {
          noteOff(previousEntry.note);
        }
        if (nextEntry) {
          noteOn(nextEntry.note);
        }
        pointerKeysRef.current.set(e.pointerId, nextIndex);
        setFocusedIndex(nextIndex);
        keyElementsRef.current.get(nextIndex)?.focus();
      },
      [keyLayout, noteOff, noteOn]
    );

    const releasePointer = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const index = pointerKeysRef.current.get(e.pointerId);
        if (index === undefined) {
          return;
        }
        pointerKeysRef.current.delete(e.pointerId);
        const entry = keyLayout[index];
        if (entry) {
          noteOff(entry.note);
        }
        trackRef.current?.releasePointerCapture(e.pointerId);
      },
      [keyLayout, noteOff]
    );

    const tapKey = React.useCallback(
      (index: number) => {
        const entry = keyLayout[index];
        if (!entry) {
          return;
        }
        noteOn(entry.note);
        noteOff(entry.note);
      },
      [keyLayout, noteOn, noteOff]
    );

    const focusKey = React.useCallback(
      (index: number) => {
        const clamped = clamp(index, 0, keyLayout.length - 1);
        setFocusedIndex(clamped);
        keyElementsRef.current.get(clamped)?.focus();
      },
      [keyLayout.length]
    );

    const registerKey = React.useCallback(
      (index: number, node: Nullable<HTMLElement>) => {
        if (node) {
          keyElementsRef.current.set(index, node);
        } else {
          keyElementsRef.current.delete(index);
        }
      },
      []
    );

    const pointerHandlers = React.useMemo(
      () => ({
        onPointerCancel: releasePointer,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: releasePointer,
      }),
      [handlePointerDown, handlePointerMove, releasePointer]
    );

    const activeNoteSet = React.useMemo(() => {
      const set = new Set(pressedNotes);
      if (activeNotes) {
        for (const note of activeNotes) {
          set.add(note);
        }
      }
      return set;
    }, [pressedNotes, activeNotes]);

    const elementId = id || pianoId;

    const configValue = React.useMemo<ConfigContextValue>(
      () => ({
        ariaLabel,
        ariaLabelledBy,
        disabled,
        elementId,
        focusKey,
        keyLayout,
        pointerHandlers,
        registerKey,
        setFocusedIndex,
        shouldPreventFocusRef,
        tapKey,
        trackRef,
      }),
      [
        ariaLabel,
        ariaLabelledBy,
        disabled,
        elementId,
        focusKey,
        keyLayout,
        pointerHandlers,
        registerKey,
        tapKey,
      ]
    );

    const valueContextValue = React.useMemo<ValueContextValue>(
      () => ({ activeNoteSet, focusedIndex }),
      [activeNoteSet, focusedIndex]
    );

    return (
      <ConfigContext.Provider value={configValue}>
        <ValueContext.Provider value={valueContextValue}>
          <div
            className={className}
            {...getDataAttributes("piano", {
              disabled,
              part: "piano-wrapper",
            })}
            {...props}
          >
            {ariaLabel || ariaLabelledBy ? null : (
              <span className="sr-only" id={`${elementId}-label`}>
                Piano
              </span>
            )}
            <span className="sr-only" id={`${elementId}-instructions`}>
              Use arrow keys to move between notes, space or enter to play.
            </span>
            {children}
          </div>
        </ValueContext.Provider>
      </ConfigContext.Provider>
    );
  }

  export interface TrackProps extends React.ComponentProps<"div"> {}

  export function Track({ className, style, ...props }: TrackProps) {
    const {
      ariaLabel,
      ariaLabelledBy,
      disabled,
      elementId,
      pointerHandlers,
      trackRef,
    } = useConfigContext();

    return (
      <div
        aria-label={ariaLabel || "Piano"}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        className={className}
        {...getDataAttributes("piano", { disabled, part: "track" })}
        {...pointerHandlers}
        ref={trackRef}
        role="group"
        style={{ position: "relative", touchAction: "none", ...style }}
        {...props}
      />
    );
  }

  export interface KeysProps {
    children: (
      note: number,
      color: "white" | "black",
      index: number
    ) => React.ReactNode;
  }

  export function Keys({ children }: KeysProps) {
    const { keyLayout } = useConfigContext();
    return (
      <>
        {keyLayout.map((entry, index) => (
          <KeyIndexContext.Provider key={entry.note} value={index}>
            {children(entry.note, entry.color, index)}
          </KeyIndexContext.Provider>
        ))}
      </>
    );
  }

  export interface KeyProps
    extends Omit<React.ComponentProps<"div">, "children"> {
    children?: React.ReactNode;
    index: number;
  }

  export function Key({
    index,
    className,
    children,
    "aria-describedby": ariaDescribedBy,
    ...props
  }: KeyProps) {
    const {
      ariaLabel,
      disabled,
      elementId,
      focusKey,
      keyLayout,
      registerKey,
      setFocusedIndex,
      shouldPreventFocusRef,
      tapKey,
    } = useConfigContext();
    const { activeNoteSet, focusedIndex } = useValueContext();
    const entry = keyLayout[index];

    const { keyboardProps } = useKeyboardNavigation({
      disabled,
      handlers: {
        onArrowLeft: () => {
          focusKey(index - 1);
          return true;
        },
        onArrowRight: () => {
          focusKey(index + 1);
          return true;
        },
        onEnd: () => {
          focusKey(keyLayout.length - 1);
          return true;
        },
        onEnter: (e) => {
          if (!e.repeat) {
            tapKey(index);
          }
          return true;
        },
        onHome: () => {
          focusKey(0);
          return true;
        },
      },
      onKeyDown: (e) => {
        if (!(disabled || e.repeat) && e.key === " ") {
          e.preventDefault();
          tapKey(index);
        }
      },
    });

    const handleFocus = React.useCallback(() => {
      if (shouldPreventFocusRef.current) {
        shouldPreventFocusRef.current = false;
      }
      setFocusedIndex(index);
    }, [index, setFocusedIndex, shouldPreventFocusRef]);

    const keyRef = React.useCallback(
      (node: Nullable<HTMLElement>) => registerKey(index, node),
      [index, registerKey]
    );

    if (!entry) {
      return null;
    }

    const isPressed = activeNoteSet.has(entry.note);
    const isFocusTarget = index === focusedIndex;
    const noteName = getNoteName(entry.note);

    return (
      <div
        aria-describedby={ariaDescribedBy || `${elementId}-instructions`}
        aria-disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} ${noteName}` : noteName}
        aria-pressed={isPressed}
        className={className}
        {...getDataAttributes("piano", {
          color: entry.color,
          disabled,
          part: "key",
          pressed: isPressed,
        })}
        onFocus={handleFocus}
        ref={keyRef}
        role="button"
        style={{
          left: `${entry.leftPercent}%`,
          position: "absolute",
          width: `${entry.widthPercent}%`,
        }}
        tabIndex={disabled || !isFocusTarget ? -1 : 0}
        {...keyboardProps}
        {...props}
      >
        {children}
      </div>
    );
  }

  export interface KeyLabelProps extends React.ComponentProps<"span"> {}

  export function KeyLabel({ className, ...props }: KeyLabelProps) {
    const { keyLayout } = useConfigContext();
    const index = useKeyIndex();
    const entry = keyLayout[index];

    return (
      <span
        aria-hidden="true"
        className={className}
        {...getDataAttributes("piano", { part: "key-label" })}
        {...props}
      >
        {entry ? getNoteName(entry.note) : null}
      </span>
    );
  }
}
