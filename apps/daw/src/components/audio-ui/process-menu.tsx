import type {
  DitherMethod,
  ShiftMethod,
  StretchMethod,
} from "@audio-ui/engine/files";
import type { Repair } from "@audio-ui/engine/repair";
import { type ReactNode, useCallback } from "react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { REPAIR_NAMES, type SoundOperation } from "@/lib/sound-operations";

/** One operation as the menu offers it: what it says, with a note at its end. */
interface OperationEntry {
  label: string;
  note?: string;
  operation: SoundOperation;
}

/** The ways of one method, its operations in a submenu of their own. */
interface MethodEntry {
  items: readonly OperationEntry[];
  label: string;
  note: string;
}

const REPEAT_ITEMS = [2, 3, 4, 8].map(
  (times): OperationEntry => ({
    label: `${times} times`,
    operation: { times, type: "repeat" },
  })
);

const PAD_ITEMS = [0.5, 1, 2].map(
  (seconds): OperationEntry => ({
    label: `${seconds} s at the end`,
    operation: { seconds, type: "pad" },
  })
);

const NORMALIZE_ITEMS: readonly OperationEntry[] = [
  {
    label: "Peak to -1 dBFS",
    note: "Safe ceiling",
    operation: { target: { peak: -1 }, type: "normalize" },
  },
  {
    label: "-23 LUFS",
    note: "Broadcast, EBU R128",
    operation: { target: { lufs: -23 }, type: "normalize" },
  },
  {
    label: "-16 LUFS",
    note: "Podcasts",
    operation: { target: { lufs: -16 }, type: "normalize" },
  },
  {
    label: "-14 LUFS",
    note: "Streaming",
    operation: { target: { lufs: -14 }, type: "normalize" },
  },
];

const PAN_ITEMS: readonly OperationEntry[] = [
  { label: "Left", operation: { pan: -1, type: "pan" } },
  { label: "Half left", operation: { pan: -0.5, type: "pan" } },
  { label: "Half right", operation: { pan: 0.5, type: "pan" } },
  { label: "Right", operation: { pan: 1, type: "pan" } },
];

const DITHERS: readonly MethodEntry[] = (
  [
    { label: "Triangular", method: "tpdf", note: "Steady noise" },
    { label: "Noise-shaped", method: "shaped", note: "Noise moved up" },
    { label: "Error feedback", method: "feedback", note: "No added noise" },
  ] as const satisfies readonly {
    label: string;
    method: DitherMethod;
    note: string;
  }[]
).map(({ label, method, note }) => ({
  items: [16, 8].map(
    (bits): OperationEntry => ({
      label: `${bits} bits`,
      operation: { bits, method, type: "dither" },
    })
  ),
  label,
  note,
}));

const FILTER_ITEMS: readonly OperationEntry[] = [
  {
    label: "Remove rumble",
    note: "High-pass 40 Hz",
    operation: { filter: "highpass", frequency: 40, type: "filter" },
  },
  {
    label: "Thin the lows",
    note: "High-pass 80 Hz",
    operation: { filter: "highpass", frequency: 80, type: "filter" },
  },
  {
    label: "Soften the highs",
    note: "Low-pass 8 kHz",
    operation: { filter: "lowpass", frequency: 8000, type: "filter" },
  },
  {
    label: "Telephone",
    note: "Low-pass 3 kHz",
    operation: { filter: "lowpass", frequency: 3000, type: "filter" },
  },
];

const STRETCHES: readonly MethodEntry[] = (
  [
    { label: "Transient-aware", method: "transient", note: "Music with drums" },
    { label: "Phase vocoder", method: "pvocLock", note: "General music" },
    { label: "Overlap-add", method: "wsola", note: "Speech, shorter" },
    {
      label: "Vocoder and overlap-add",
      method: "pvsola",
      note: "Speech, longer",
    },
    { label: "Hybrid", method: "hybrid", note: "Full mixes" },
    { label: "PaulStretch", method: "paulstretch", note: "Ambient, extreme" },
  ] as const satisfies readonly {
    label: string;
    method: StretchMethod;
    note: string;
  }[]
).map(({ label, method, note }) => ({
  items: [0.5, 0.75, 1.25, 1.5, 2].map(
    (factor): OperationEntry => ({
      label: `${Math.round(factor * 100)} % as long`,
      operation: { factor, method, type: "stretch" },
    })
  ),
  label,
  note,
}));

const SHIFTS: readonly MethodEntry[] = (
  [
    { label: "Automatic", method: "auto", note: "Chosen from the sound" },
    { label: "Transient-aware", method: "transient", note: "Music with drums" },
    { label: "Phase-locked", method: "phaseLock", note: "General music" },
    {
      label: "Formant-preserving",
      method: "formant",
      note: "Voice, keeps its character",
    },
  ] as const satisfies readonly {
    label: string;
    method: ShiftMethod;
    note: string;
  }[]
).map(({ label, method, note }) => ({
  items: [12, 7, 5, 2, -2, -5, -7, -12].map(
    (semitones): OperationEntry => ({
      label: `${semitones > 0 ? "+" : ""}${semitones} semitones`,
      operation: { method, semitones, type: "shift" },
    })
  ),
  label,
  note,
}));

const SPEED_ITEMS = [0.5, 0.75, 1.25, 1.5, 2].map(
  (speed): OperationEntry => ({
    label: `×${speed}`,
    operation: { speed, type: "speed" },
  })
);

const REPAIR_ITEMS = (
  [
    { note: "Finds the defect", repair: "clean" },
    { note: "Vinyl, mouth, splices", repair: "clicks" },
    { note: "Shellac, dense ticks", repair: "crackle" },
    { note: "Europe, Africa, Asia", repair: "hum50" },
    { note: "Americas", repair: "hum60" },
    { note: "Steady hiss", repair: "noise" },
    { note: "Changing noise", repair: "speechNoise" },
    { note: "Rebuilds cut peaks", repair: "clipping" },
    { note: "Low rumble", repair: "wind" },
    { note: "P and b bursts", repair: "plosives" },
    { note: "Between phrases", repair: "breaths" },
    { note: "A room's tail", repair: "reverb" },
  ] as const satisfies readonly { note: string; repair: Repair }[]
).map(
  ({ note, repair }): OperationEntry => ({
    label: REPAIR_NAMES[repair],
    note,
    operation: { repair, type: "repair" },
  })
);

const REVERSE: OperationEntry = {
  label: "Reverse",
  operation: { type: "reverse" },
};

/** What a menu row says at its end, in a lighter tone. */
function Note({ children }: { children: ReactNode }) {
  return (
    <span className="ms-auto text-muted-foreground text-xs">{children}</span>
  );
}

/** One operation, as an item. */
function OperationItem({
  disabled,
  entry,
  onProcess,
}: {
  disabled?: boolean;
  entry: OperationEntry;
  onProcess: (operation: SoundOperation) => void;
}) {
  const run = useCallback(
    () => onProcess(entry.operation),
    [entry.operation, onProcess]
  );
  return (
    <DropdownMenuItem disabled={disabled} onClick={run}>
      {entry.label}
      {entry.note ? <Note>{entry.note}</Note> : null}
    </DropdownMenuItem>
  );
}

/** A submenu named `label` of `items`. */
function OperationSub({
  className,
  disabled,
  items,
  label,
  note,
  onProcess,
}: {
  className: string;
  disabled?: boolean;
  items: readonly OperationEntry[];
  label: string;
  note?: string;
  onProcess: (operation: SoundOperation) => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        {label}
        {note ? <Note>{note}</Note> : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={className}>
        {items.map((entry) => (
          <OperationItem
            entry={entry}
            key={entry.label}
            onProcess={onProcess}
          />
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** A submenu named `label` of methods, each a submenu of its operations. */
function MethodSub({
  disabled,
  label,
  methods,
  onProcess,
  width,
}: {
  disabled?: boolean;
  label: string;
  methods: readonly MethodEntry[];
  onProcess: (operation: SoundOperation) => void;
  width: string;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={width}>
        {methods.map((method) => (
          <OperationSub
            className="w-48"
            items={method.items}
            key={method.label}
            label={method.label}
            note={method.note}
            onProcess={onProcess}
          />
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * The Process menu's items, in four groups: Structure (Reverse, Repeat, Add
 * silence), Level and tone (Normalize, Pan, Dither, Filter), Time and pitch
 * (Stretch, Pitch, Speed, each by the method picked) and Repair. Place them in
 * a dropdown menu's content or a submenu's; `children` go first in Structure,
 * for the edits of your own.
 */
export function ProcessMenuItems({
  children,
  disabled,
  onProcess,
}: {
  /** Items of your own, at the top of the Structure group. */
  children?: ReactNode;
  /** Whether there is nothing to process: every item is greyed out. */
  disabled?: boolean;
  /** An operation was picked: run it with `applySoundOperation`. */
  onProcess: (operation: SoundOperation) => void;
}) {
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Structure</DropdownMenuLabel>
        {children}
        <OperationItem
          disabled={disabled}
          entry={REVERSE}
          onProcess={onProcess}
        />
        <OperationSub
          className="w-48"
          disabled={disabled}
          items={REPEAT_ITEMS}
          label="Repeat"
          onProcess={onProcess}
        />
        <OperationSub
          className="w-48"
          disabled={disabled}
          items={PAD_ITEMS}
          label="Add silence"
          onProcess={onProcess}
        />
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Level and tone</DropdownMenuLabel>
        <OperationSub
          className="w-64"
          disabled={disabled}
          items={NORMALIZE_ITEMS}
          label="Normalize"
          onProcess={onProcess}
        />
        <OperationSub
          className="w-48"
          disabled={disabled}
          items={PAN_ITEMS}
          label="Pan"
          onProcess={onProcess}
        />
        <MethodSub
          disabled={disabled}
          label="Dither"
          methods={DITHERS}
          onProcess={onProcess}
          width="w-64"
        />
        <OperationSub
          className="w-64"
          disabled={disabled}
          items={FILTER_ITEMS}
          label="Filter"
          onProcess={onProcess}
        />
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Time and pitch</DropdownMenuLabel>
        <MethodSub
          disabled={disabled}
          label="Stretch"
          methods={STRETCHES}
          onProcess={onProcess}
          width="w-72"
        />
        <MethodSub
          disabled={disabled}
          label="Pitch"
          methods={SHIFTS}
          onProcess={onProcess}
          width="w-72"
        />
        <OperationSub
          className="w-48"
          disabled={disabled}
          items={SPEED_ITEMS}
          label="Speed"
          onProcess={onProcess}
        />
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Repair</DropdownMenuLabel>
        <OperationSub
          className="w-80"
          disabled={disabled}
          items={REPAIR_ITEMS}
          label="Remove a defect"
          onProcess={onProcess}
        />
      </DropdownMenuGroup>
    </>
  );
}
