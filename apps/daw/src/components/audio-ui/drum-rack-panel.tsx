"use client";

import { pitchName } from "@audio-ui/core/pitch";
import type { Pad as PadPrimitive } from "@audio-ui/react";
import { type DragEvent, type ReactNode, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Knob } from "@/components/audio-ui/knob";
import { Pad, PadItem } from "@/components/audio-ui/pad";
import {
  type RackChainMix,
  RackChainRow,
  RackFrame,
  RackMacros,
  type RackParameter,
} from "@/components/audio-ui/rack-panel";
import {
  DRUM_DECAYS,
  type DrumSound,
  type DrumVoice,
  type Rack,
  type RackChain,
  type RackMapping,
} from "@/lib/arrangement";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";

/** How many pads a bank shows, four by four. */
const BANK = 16;
/** Where the banks start: one on C2 (note 36), so a kit's usual notes are the bank first shown. */
const OFFSET = 4;
/** How many banks it takes to cover the 128 notes: the lowest starts below note 0. */
const BANKS = Math.ceil((128 + BANK - OFFSET) / BANK);
const baseOf = (bank: number) => bank * BANK + OFFSET - BANK;
const bankOf = (note: number) => Math.floor((note - OFFSET + BANK) / BANK);
const isNote = (note: number) => note >= 0 && note <= 127;

/** The rows of a bank's grid, top to bottom: its lowest notes sit at the bottom left. */
const ROWS = [12, 8, 4, 0];
const COLUMNS = [0, 1, 2, 3];

const VOICES: readonly { label: string; voice: DrumVoice }[] = [
  { label: "Kick", voice: "kick" },
  { label: "Snare", voice: "snare" },
  { label: "Hat", voice: "hat" },
];

const semitones = (value: number) =>
  `${value > 0 ? "+" : ""}${Math.round(value)} st`;
const seconds = (value: number) =>
  value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(2)} s`;
const ignore = () => undefined;

/** The pad that answers `note`, when one does. */
const padAt = (rack: Rack, note: number): RackChain | undefined =>
  rack.chains.find((chain) => chain.pad?.note === note);

/** The notes a bank covers, by name: middle C is C4. */
const rangeOf = (bank: number) =>
  `${pitchName(Math.max(0, baseOf(bank)))} to ${pitchName(Math.min(127, baseOf(bank) + BANK - 1))}`;

const hasFiles = (event: DragEvent<HTMLElement>) =>
  event.dataTransfer.types.includes("Files");

/** A knob with its name under it. */
function Caption({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {children}
      <span aria-hidden="true" className="text-[10px] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function VoiceToggle({
  label,
  onPick,
  pressed,
  voice,
}: {
  label: string;
  onPick: (voice: DrumVoice, label: string) => void;
  pressed: boolean;
  voice: DrumVoice;
}) {
  const pick = useCallback(() => onPick(voice, label), [label, onPick, voice]);
  return (
    <Toggle
      onPressedChange={pick}
      pressed={pressed}
      size="sm"
      variant="outline"
    >
      {label}
    </Toggle>
  );
}

/** The choke groups a pad can be in, or none. */
const CHOKE_GROUPS = [
  { label: "No choke", value: "none" },
  ...[1, 2, 3, 4].map((group) => ({
    label: `Choke ${group}`,
    value: String(group),
  })),
];

/** The pad's choke group: a hit on another pad of it cuts this one short. */
function ChokeSelect({
  chain,
  onPadChoke,
}: {
  chain: RackChain;
  onPadChoke: (chain: string, choke: number | null) => void;
}) {
  const pick = useCallback(
    (value: string | null) =>
      onPadChoke(chain.id, !value || value === "none" ? null : Number(value)),
    [chain.id, onPadChoke]
  );
  return (
    <Select
      items={CHOKE_GROUPS}
      onValueChange={pick}
      value={chain.pad?.choke === undefined ? "none" : String(chain.pad.choke)}
    >
      <SelectTrigger
        aria-label={`${chain.name} choke group`}
        className="h-6 w-28 shrink-0"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {CHOKE_GROUPS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** The picked pad: which voice it plays, its pitch and decay, or else the instrument at its head; its chain's mix and its choke group. */
function PadEditor({
  chain,
  note,
  onChainMix,
  onChainMixCommit,
  onPadChange,
  onPadChoke,
  onPadCommit,
  onPadSound,
  onRemovePad,
}: {
  chain: RackChain | undefined;
  note: number;
  onChainMix: (chain: string, mix: Partial<RackChainMix>) => void;
  onChainMixCommit?: () => void;
  onPadChange: (
    chain: string,
    change: { decay?: number; tune?: number }
  ) => void;
  onPadChoke?: (chain: string, choke: number | null) => void;
  onPadCommit?: () => void;
  onPadSound: (note: number, sound: DrumSound, name: string) => void;
  onRemovePad: (chain: string) => void;
}) {
  // An instrument at the head of the chain is the pad's sound: its own panel, among the pad's devices, shapes it.
  const played = Boolean(chain?.devices[0]?.instrument);
  const sound = played ? undefined : chain?.pad?.sound;
  const id = chain?.id ?? "";
  const pick = useCallback(
    (voice: DrumVoice, label: string) =>
      onPadSound(
        note,
        {
          decay: DRUM_DECAYS[voice],
          kind: "synth",
          tune: sound?.tune ?? 0,
          voice,
        },
        label
      ),
    [note, onPadSound, sound?.tune]
  );
  const tune = useCallback(
    (value: number) => onPadChange(id, { tune: value }),
    [id, onPadChange]
  );
  const decay = useCallback(
    (value: number) => onPadChange(id, { decay: value }),
    [id, onPadChange]
  );
  return (
    <div
      aria-label={`Pad ${pitchName(note)}`}
      className="flex flex-col gap-2 border-b p-2"
      data-slot="drum-pad-editor"
      role="group"
    >
      <div className="flex items-center gap-1">
        <span className="me-1 w-8 shrink-0 text-muted-foreground text-xs tabular-nums">
          {pitchName(note)}
        </span>
        {played ? (
          <span className="truncate text-xs">{chain?.name}</span>
        ) : (
          VOICES.map((item) => (
            <VoiceToggle
              key={item.voice}
              label={item.label}
              onPick={pick}
              pressed={sound?.kind === "synth" && sound.voice === item.voice}
              voice={item.voice}
            />
          ))
        )}
        {chain && onPadChoke ? (
          <span className="ms-auto">
            <ChokeSelect chain={chain} onPadChoke={onPadChoke} />
          </span>
        ) : null}
      </div>
      {chain && (played || sound) ? (
        <div className="flex items-center gap-3">
          {sound ? (
            <>
              <Caption label="Tune">
                <Knob
                  anchor={0}
                  aria-label={`${chain.name} tune`}
                  formatValue={semitones}
                  max={24}
                  min={-24}
                  onValueChange={tune}
                  onValueCommitted={onPadCommit}
                  size="sm"
                  step={1}
                  value={sound.tune}
                  valueLabel="hidden"
                />
              </Caption>
              <Caption label="Decay">
                <Knob
                  aria-label={`${chain.name} decay`}
                  formatValue={seconds}
                  max={4}
                  min={0.02}
                  onValueChange={decay}
                  onValueCommitted={onPadCommit}
                  scale="log"
                  size="sm"
                  step={0.001}
                  value={sound.decay}
                  valueLabel="hidden"
                />
              </Caption>
            </>
          ) : null}
          <ul aria-label="Pad mix" className="min-w-0 flex-1">
            <RackChainRow
              chain={chain}
              onMix={onChainMix}
              onMixCommit={onChainMixCommit}
              onRemove={onRemovePad}
              onSelect={ignore}
              removable
              selected={false}
            />
          </ul>
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">
          Empty: pick a voice, drop a recording on the pad, or drag a Drum Synth
          onto it.
        </span>
      )}
    </div>
  );
}

/**
 * The face of a drum rack: its eight macros, shown from the title bar; its pads, sixteen at a time on
 * a bank of the 128 notes, each named for the sound it plays, the lowest note
 * at the bottom left; the picked pad's voice, pitch, decay and mix; and the
 * picked pad's devices, which the host draws as `children`. Striking a pad
 * picks it and plays it through `onPadOn`; a recording dropped on a pad goes
 * to `onDropFiles`. Controlled: every change is a callback, and the knobs
 * report the end of a turn with the commit callbacks.
 */
function DrumRackPanel({
  children,
  className,
  controls,
  enabled = true,
  macrosShown,
  onMacrosShownChange,
  onChainMix,
  onChainMixCommit,
  onDropFiles,
  onEnabledChange,
  onMacroChange,
  onMacroCommit,
  onMapMacro,
  onPadChange,
  onPadChoke,
  onPadCommit,
  onPadOff,
  onPadOn,
  onPadSound,
  onRemovePad,
  onSelectNote,
  onUnmapMacro,
  parameters,
  rack,
  selectedNote,
  title = "Drum rack",
}: {
  /** The picked pad's devices. */
  children?: ReactNode;
  className?: string;
  /** What sits at the end of the title bar: a host's grip, fold and remove buttons. */
  controls?: ReactNode;
  /** Whether the rack is on; with `onEnabledChange`, its square in the title bar. */
  enabled?: boolean;
  /** Whether the macros show, controlled: to keep it past a reload, say. */
  macrosShown?: boolean;
  /** The title bar's switch of the macros was pressed. */
  onMacrosShownChange?: (shown: boolean) => void;
  onChainMix: (chain: string, mix: Partial<RackChainMix>) => void;
  onChainMixCommit?: () => void;
  /** Files dropped on the pad of `note`: a recording to play there. */
  onDropFiles?: (note: number, files: File[]) => void;
  onEnabledChange?: (enabled: boolean) => void;
  onMacroChange: (index: number, value: number) => void;
  onMacroCommit?: () => void;
  onMapMacro: (index: number, parameter: RackParameter) => void;
  /** A turn of the picked pad's tune or decay knob. */
  onPadChange: (
    chain: string,
    change: { decay?: number; tune?: number }
  ) => void;
  /** The picked pad put in a choke group, or taken out of one with `null`; leave it out for no choke control. */
  onPadChoke?: (chain: string, choke: number | null) => void;
  onPadCommit?: () => void;
  /** A pad let go of. */
  onPadOff?: (note: number) => void;
  /** A pad struck, as hard as `velocity`, 0 to 1. */
  onPadOn?: (note: number, velocity: number) => void;
  /** A voice picked for the pad of `note`, named `name`: a new pad when the note had none. */
  onPadSound: (note: number, sound: DrumSound, name: string) => void;
  onRemovePad: (chain: string) => void;
  onSelectNote: (note: number) => void;
  onUnmapMacro: (index: number, mapping: RackMapping) => void;
  /** The parameters of the devices inside that a macro can turn. */
  parameters: readonly RackParameter[];
  rack: Rack;
  /** The note of the pad picked, 0 to 127. */
  selectedNote: number;
  /** Its name in the title bar. @default "Drum rack" */
  title?: string;
}) {
  const [bank, setBank] = useState(() => bankOf(selectedNote));
  const lower = useCallback(() => setBank((at) => Math.max(0, at - 1)), []);
  const higher = useCallback(
    () => setBank((at) => Math.min(BANKS - 1, at + 1)),
    []
  );
  const strike = useCallback(
    (value: string, details: PadPrimitive.Root.OnEventDetails) => {
      const note = Number(value);
      onSelectNote(note);
      onPadOn?.(note, details.velocity);
    },
    [onPadOn, onSelectNote]
  );
  const release = useCallback(
    (value: string) => onPadOff?.(Number(value)),
    [onPadOff]
  );
  const dragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (onDropFiles && hasFiles(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    },
    [onDropFiles]
  );
  const drop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const note = Number(event.currentTarget.dataset.note);
      if (!(onDropFiles && hasFiles(event)) || Number.isNaN(note)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onSelectNote(note);
      onDropFiles(note, [...event.dataTransfer.files]);
    },
    [onDropFiles, onSelectNote]
  );
  const base = baseOf(bank);
  return (
    <RackFrame
      className={className}
      controls={controls}
      enabled={enabled}
      macros={
        <RackMacros
          macros={rack.macros}
          onMacroChange={onMacroChange}
          onMacroCommit={onMacroCommit}
          onMapMacro={onMapMacro}
          onUnmapMacro={onUnmapMacro}
          parameters={parameters}
        />
      }
      macrosShown={macrosShown}
      onEnabledChange={onEnabledChange}
      onMacrosShownChange={onMacrosShownChange}
      slot="drum-rack-panel"
      title={title}
    >
      <div className="flex w-60 shrink-0 flex-col gap-1 p-2">
        <div className="flex items-center gap-1">
          <Button
            aria-label="Lower pads"
            disabled={bank === 0}
            onClick={lower}
            size="icon-sm"
            variant="ghost"
          >
            <CaretDownIcon aria-hidden="true" className="size-4" />
          </Button>
          <span className="flex-1 text-center text-muted-foreground text-xs tabular-nums">
            {rangeOf(bank)}
          </span>
          <Button
            aria-label="Higher pads"
            disabled={bank === BANKS - 1}
            onClick={higher}
            size="icon-sm"
            variant="ghost"
          >
            <CaretUpIcon aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <Pad
          aria-label="Pads"
          className="gap-1"
          columns={4}
          onPadOff={release}
          onPadOn={strike}
        >
          {ROWS.flatMap((row) =>
            COLUMNS.map((column) => {
              const note = base + row + column;
              const chain = padAt(rack, note);
              if (!isNote(note)) {
                return (
                  <span
                    aria-hidden="true"
                    className="aspect-square rounded-md border border-dashed opacity-40"
                    key={note}
                  />
                );
              }
              return (
                <PadItem
                  aria-label={`${chain?.name ?? "Empty"} ${pitchName(note)}`}
                  className={cn(
                    "flex-col items-start justify-between p-1 text-[10px]",
                    !chain && "text-muted-foreground",
                    note === selectedNote && "ring-2 ring-primary/50"
                  )}
                  data-note={note}
                  key={note}
                  onDragOver={dragOver}
                  onDrop={drop}
                  value={String(note)}
                >
                  <span className="w-full truncate">{chain?.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {pitchName(note)}
                  </span>
                </PadItem>
              );
            })
          )}
        </Pad>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PadEditor
          chain={padAt(rack, selectedNote)}
          note={selectedNote}
          onChainMix={onChainMix}
          onChainMixCommit={onChainMixCommit}
          onPadChange={onPadChange}
          onPadChoke={onPadChoke}
          onPadCommit={onPadCommit}
          onPadSound={onPadSound}
          onRemovePad={onRemovePad}
        />
        <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
      </div>
    </RackFrame>
  );
}

export { DrumRackPanel };