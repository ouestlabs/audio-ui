"use client";

import key from "@audio/mir-key";
import {
  pitchClassName,
  SCALES,
  type Scale,
  type ScaleName,
} from "@audio-ui/core/pitch";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
} from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";

/** Each scale's name, as the menu writes it. */
export const SCALE_LABELS: Record<ScaleName, string> = {
  blues: "Blues",
  chromatic: "Chromatic",
  dorian: "Dorian",
  "harmonic-minor": "Harmonic minor",
  locrian: "Locrian",
  lydian: "Lydian",
  major: "Major",
  "pentatonic-major": "Major pentatonic",
  "melodic-minor": "Melodic minor",
  minor: "Minor",
  "pentatonic-minor": "Minor pentatonic",
  mixolydian: "Mixolydian",
  phrygian: "Phrygian",
  whole: "Whole tone",
};
const SCALE_NAMES = Object.keys(SCALES) as ScaleName[];
const ROOTS = Array.from({ length: 12 }, (_, root) => root);

/** "D Dorian": a scale's root and its name. */
export const scaleLabel = (scale: Scale) =>
  `${pitchClassName(scale.root)} ${SCALE_LABELS[scale.name]}`;

/** What a key is read from: a note's pitch and how long it lasts, in any unit. A muted note counts for nothing. */
export interface KeyNote {
  length: number;
  muted?: boolean;
  pitch: number;
}

const PITCH_CLASSES = [
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

/**
 * The keys `notes` are likeliest in, likeliest first, at most `count`: each
 * pitch class weighed by how long it sounds, against the major and minor key
 * profiles of `@audio/mir-key` (Krumhansl-Schmuckler). `audio` adds the
 * sound of recordings, a weight per pitch class in the same unit as the
 * notes' lengths, such as an `audioChroma` times the seconds it plays. One
 * part alone is often ambiguous, as a bass line is: pass every part of the
 * song. None for no notes and no sound.
 */
export function detectKeys(
  notes: readonly KeyNote[],
  count = 3,
  audio?: readonly number[]
): Scale[] {
  const chroma = Array.from({ length: 12 }, (_, at) => audio?.[at] ?? 0);
  for (const note of notes) {
    if (!note.muted && note.length > 0) {
      const at = ((Math.round(note.pitch) % 12) + 12) % 12;
      chroma[at] = (chroma[at] as number) + note.length;
    }
  }
  // One pitch class alone, or none, correlates with nothing.
  if (chroma.filter((weight) => weight > 0).length < 2) {
    return [];
  }
  return key(chroma)
    .scores.slice(0, count)
    .map(({ label }) => {
      const minor = label.endsWith("m");
      return {
        name: minor ? "minor" : "major",
        root: PITCH_CLASSES.indexOf(minor ? label.slice(0, -1) : label),
      } satisfies Scale;
    });
}

interface ScaleMenuContextValue {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onScaleChange: (scale: Scale) => void;
  scale: Scale;
}

const ScaleMenuContext = createContext<ScaleMenuContextValue | null>(null);

function useScaleMenu() {
  const context = use(ScaleMenuContext);
  if (!context) {
    throw new Error("ScaleMenu parts must be placed inside a ScaleMenu.");
  }
  return context;
}

interface ScaleMenuProps {
  children: ReactNode;
  /** Whether the scale is in use, such as marked on a roll's rows. */
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Picking a root or a scale also turns it on. */
  onScaleChange: (scale: Scale) => void;
  /** The root and the scale, kept while the scale is off. */
  scale: Scale;
}

/** A menu that picks a root and a scale, and turns the scale on or off. */
function ScaleMenu({
  children,
  enabled,
  onEnabledChange,
  onScaleChange,
  scale,
}: ScaleMenuProps) {
  const value = useMemo(
    () => ({ enabled, onEnabledChange, onScaleChange, scale }),
    [enabled, onEnabledChange, onScaleChange, scale]
  );
  return (
    <ScaleMenuContext value={value}>
      <DropdownMenu>{children}</DropdownMenu>
    </ScaleMenuContext>
  );
}

/** The button that opens the menu: filled and named after the scale when it is on, "Scale" when off. */
function ScaleMenuTrigger(
  props: Omit<ComponentProps<typeof Button>, "children" | "variant">
) {
  const { enabled, scale } = useScaleMenu();
  return (
    <DropdownMenuTrigger
      render={
        <Button
          aria-label={`Scale: ${enabled ? scaleLabel(scale) : "off"}`}
          data-slot="scale-menu-trigger"
          variant={enabled ? "default" : "outline"}
          {...props}
        />
      }
    >
      {enabled ? scaleLabel(scale) : "Scale"}
    </DropdownMenuTrigger>
  );
}

function ScaleMenuContent({
  align = "end",
  className,
  ...props
}: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align={align}
      className={cn("w-auto min-w-48", className)}
      data-slot="scale-menu-content"
      {...props}
    />
  );
}

/** A checkbox item that turns the scale on or off. Its children are the label. */
function ScaleMenuToggle({
  children = "Mark the scale",
  ...props
}: Omit<
  ComponentProps<typeof DropdownMenuCheckboxItem>,
  "checked" | "onCheckedChange"
>) {
  const { enabled, onEnabledChange } = useScaleMenu();
  return (
    <DropdownMenuCheckboxItem
      checked={enabled}
      data-slot="scale-menu-toggle"
      onCheckedChange={onEnabledChange}
      {...props}
    >
      {children}
    </DropdownMenuCheckboxItem>
  );
}

/** A submenu of the twelve roots. */
function ScaleMenuRoot() {
  const { onEnabledChange, onScaleChange, scale } = useScaleMenu();
  const changeRoot = useCallback(
    (root: number) => {
      onScaleChange({ ...scale, root });
      onEnabledChange(true);
    },
    [onEnabledChange, onScaleChange, scale]
  );
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-slot="scale-menu-root">
        Root: {pitchClassName(scale.root)}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup onValueChange={changeRoot} value={scale.root}>
          {ROOTS.map((root) => (
            <DropdownMenuRadioItem key={root} value={root}>
              {pitchClassName(root)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** A submenu of the scales, by name. */
function ScaleMenuName() {
  const { onEnabledChange, onScaleChange, scale } = useScaleMenu();
  const changeName = useCallback(
    (name: ScaleName) => {
      onScaleChange({ ...scale, name });
      onEnabledChange(true);
    },
    [onEnabledChange, onScaleChange, scale]
  );
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-slot="scale-menu-name">
        Scale: {SCALE_LABELS[scale.name]}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup onValueChange={changeName} value={scale.name}>
          {SCALE_NAMES.map((name) => (
            <DropdownMenuRadioItem key={name} value={name}>
              {SCALE_LABELS[name]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** One key the notes may be in, as an item of the menu. */
function ScaleMenuDetected({
  onPick,
  scale,
}: {
  onPick: (scale: Scale) => void;
  scale: Scale;
}) {
  const pick = useCallback(() => onPick(scale), [onPick, scale]);
  return (
    <DropdownMenuItem onClick={pick}>{scaleLabel(scale)}</DropdownMenuItem>
  );
}

/**
 * The keys the notes are likeliest in, three at most, likeliest first: one
 * picked sets the root and the scale and turns it on. Pass every part of the
 * song, not one: a single part is often ambiguous.
 */
function ScaleMenuDetect({
  audio,
  count = 3,
  notes,
}: {
  /** How many keys it offers. @default 3 */
  count?: number;
  /** The sound of recordings to read it from too: a weight per pitch class, C to B, in the unit of the notes' lengths. */
  audio?: readonly number[];
  /** The notes to read the key from. */
  notes: readonly KeyNote[];
}) {
  const { onEnabledChange, onScaleChange } = useScaleMenu();
  const keys = useMemo(
    () => detectKeys(notes, count, audio),
    [audio, count, notes]
  );
  const pick = useCallback(
    (picked: Scale) => {
      onScaleChange(picked);
      onEnabledChange(true);
    },
    [onEnabledChange, onScaleChange]
  );
  return (
    <DropdownMenuGroup data-slot="scale-menu-detect">
      <DropdownMenuLabel>Detected</DropdownMenuLabel>
      {keys.length === 0 ? (
        <DropdownMenuItem disabled>Nothing to read</DropdownMenuItem>
      ) : (
        keys.map((item) => (
          <ScaleMenuDetected
            key={`${item.root} ${item.name}`}
            onPick={pick}
            scale={item}
          />
        ))
      )}
    </DropdownMenuGroup>
  );
}

export {
  ScaleMenu,
  ScaleMenuContent,
  ScaleMenuDetect,
  ScaleMenuName,
  ScaleMenuRoot,
  ScaleMenuToggle,
  ScaleMenuTrigger,
};
