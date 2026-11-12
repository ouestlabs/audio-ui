import { pitchName } from "@audio-ui/core";
import type { Pad as PadPrimitive } from "@audio-ui/react";
import {
  CaretDownIcon,
  CaretUpIcon,
  UploadIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  type ChangeEvent,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { Knob } from "@/components/audio-ui/knob";
import { Pad, PadItem } from "@/components/audio-ui/pad";
import {
  decibels,
  formatPan,
  type RackChainMix,
  RackFrame,
  RackMacros,
  type RackParameter,
} from "@/components/audio-ui/rack-panel";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  DRUM_DECAYS,
  type DrumSound,
  type DrumVoice,
  type Rack,
  type RackChain,
  type RackMapping,
} from "@/lib/arrangement";
import { cn } from "@/lib/utils";

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
    <Toggle onPressedChange={pick} pressed={pressed} variant="outline">
      {label}
    </Toggle>
  );
}

/** Picks a recording from the computer for the pad of `note`, as a drop on the pad does. */
function SampleButton({
  note,
  onFiles,
}: {
  note: number;
  onFiles: (note: number, files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const open = useCallback(() => input.current?.click(), []);
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = [...(event.currentTarget.files ?? [])];
      // Cleared, so the same file picked again still loads.
      event.currentTarget.value = "";
      if (files.length > 0) {
        onFiles(note, files);
      }
    },
    [note, onFiles]
  );
  return (
    <>
      <InputGroupButton onClick={open} size="xs">
        <UploadIcon aria-hidden="true" className="size-4" />
        Sample
      </InputGroupButton>
      <input
        accept="audio/*"
        aria-hidden="true"
        className="hidden"
        onChange={change}
        ref={input}
        tabIndex={-1}
        type="file"
      />
    </>
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
        className="w-28 shrink-0"
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

/**
 * The pad as one field: its note, its name, which Enter or leaving keeps and
 * Escape takes back, and the button that loads a sample on it. An empty pad's
 * name is blank and cannot be typed.
 */
function PadField({
  chain,
  note,
  onLoadFiles,
  onRename,
}: {
  chain: RackChain | undefined;
  note: number;
  onLoadFiles?: (note: number, files: File[]) => void;
  onRename?: (chain: string, name: string) => void;
}) {
  const named = chain?.name ?? "";
  const keep = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const name = event.currentTarget.value.trim();
      if (chain && onRename && name && name !== named) {
        onRename(chain.id, name);
      } else {
        event.currentTarget.value = named;
      }
    },
    [chain, named, onRename]
  );
  const key = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.currentTarget.value = named;
      }
      if (event.key === "Enter" || event.key === "Escape") {
        event.currentTarget.blur();
      }
    },
    [named]
  );
  return (
    <InputGroup className="w-60 shrink-0">
      <InputGroupAddon>
        <InputGroupText className="w-7 text-xs tabular-nums">
          {pitchName(note)}
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        aria-label={`Name of pad ${pitchName(note)}`}
        className="text-xs"
        defaultValue={named}
        disabled={!chain}
        onBlur={keep}
        onKeyDown={key}
        placeholder="Empty"
        readOnly={!onRename}
      />
      {onLoadFiles ? (
        <InputGroupAddon align="inline-end">
          <SampleButton note={note} onFiles={onLoadFiles} />
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

/** The pad's mix: its volume and pan, named under them, on, solo, and its removal. */
function PadMix({
  chain,
  onMix,
  onMixCommit,
  onRemove,
}: {
  chain: RackChain;
  onMix: (chain: string, mix: Partial<RackChainMix>) => void;
  onMixCommit?: () => void;
  onRemove: (chain: string) => void;
}) {
  const { id, name } = chain;
  const mix = { gain: 1, muted: false, pan: 0, soloed: false, ...chain.mix };
  const setGain = useCallback(
    (gain: number) => onMix(id, { gain }),
    [id, onMix]
  );
  const setPan = useCallback((pan: number) => onMix(id, { pan }), [id, onMix]);
  // A switch is a step of its own.
  const setOn = useCallback(
    (on: boolean) => {
      onMix(id, { muted: !on });
      onMixCommit?.();
    },
    [id, onMix, onMixCommit]
  );
  const setSolo = useCallback(
    (soloed: boolean) => {
      onMix(id, { soloed });
      onMixCommit?.();
    },
    [id, onMix, onMixCommit]
  );
  const remove = useCallback(() => onRemove(id), [id, onRemove]);
  return (
    <>
      <Caption label="Volume">
        <Knob
          aria-label={`${name} volume`}
          formatValue={decibels}
          max={2}
          min={0}
          onValueChange={setGain}
          onValueCommitted={onMixCommit}
          size="sm"
          step={0.01}
          value={mix.gain}
          valueLabel="hidden"
        />
      </Caption>
      <Caption label="Pan">
        <Knob
          anchor={0}
          aria-label={`${name} pan`}
          formatValue={formatPan}
          max={1}
          min={-1}
          onValueChange={setPan}
          onValueCommitted={onMixCommit}
          size="sm"
          step={0.01}
          value={mix.pan}
          valueLabel="hidden"
        />
      </Caption>
      <Toggle
        aria-label={`${name} on`}
        onPressedChange={setOn}
        pressed={!mix.muted}
        variant="outline"
      >
        On
      </Toggle>
      <Toggle
        aria-label={`Solo ${name}`}
        onPressedChange={setSolo}
        pressed={mix.soloed}
        variant="outline"
      >
        S
      </Toggle>
      <Button
        aria-label={`Remove ${name}`}
        className="text-muted-foreground"
        onClick={remove}
        size="icon"
        variant="ghost"
      >
        <XIcon aria-hidden="true" className="size-4" />
      </Button>
    </>
  );
}

/** The picked pad on one line: its note and name, the voice or recording it plays, its choke group, its pitch and decay or else the instrument at its head, and its mix. */
function PadEditor({
  chain,
  note,
  onChainMix,
  onChainMixCommit,
  onLoadFiles,
  onPadChange,
  onPadChoke,
  onPadCommit,
  onPadSound,
  onRemovePad,
  onRenamePad,
}: {
  chain: RackChain | undefined;
  note: number;
  onChainMix: (chain: string, mix: Partial<RackChainMix>) => void;
  onChainMixCommit?: () => void;
  onLoadFiles?: (note: number, files: File[]) => void;
  onPadChange: (
    chain: string,
    change: { decay?: number; tune?: number }
  ) => void;
  onPadChoke?: (chain: string, choke: number | null) => void;
  onPadCommit?: () => void;
  onPadSound: (note: number, sound: DrumSound, name: string) => void;
  onRemovePad: (chain: string) => void;
  onRenamePad?: (chain: string, name: string) => void;
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
      className="flex min-h-16 flex-wrap items-center gap-x-2 gap-y-1 border-b p-2"
      data-slot="drum-pad-editor"
      role="group"
    >
      <PadField
        chain={chain}
        // Keyed by the name, so a name changed elsewhere, such as by a new sound, shows.
        key={`${chain?.id}:${chain?.name}`}
        note={note}
        onLoadFiles={onLoadFiles}
        onRename={onRenamePad}
      />
      {played
        ? null
        : VOICES.map((item) => (
            <VoiceToggle
              key={item.voice}
              label={item.label}
              onPick={pick}
              pressed={sound?.kind === "synth" && sound.voice === item.voice}
              voice={item.voice}
            />
          ))}
      {chain && onPadChoke ? (
        <ChokeSelect chain={chain} onPadChoke={onPadChoke} />
      ) : null}
      {chain && sound ? (
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
      {chain ? (
        <div className="ms-auto flex items-center gap-1">
          <PadMix
            chain={chain}
            onMix={onChainMix}
            onMixCommit={onChainMixCommit}
            onRemove={onRemovePad}
          />
        </div>
      ) : (
        <span className="basis-full text-muted-foreground text-xs">
          Empty: pick a voice or a sample, drop a recording on the pad, or drag
          a Drum Synth onto it.
        </span>
      )}
    </div>
  );
}

/**
 * The face of a drum rack: its eight macros, shown from the title bar; its pads, sixteen at a time on
 * a bank of the 128 notes, each named for the sound it plays, the lowest note
 * at the bottom left, lit while `activeNotes` sound them; the picked pad on one
 * line, its name a field with `onRenamePad`, its voice, pitch, decay, mix and
 * choke group; and the picked pad's devices, which the host draws as
 * `children`. Striking a pad picks it and plays it through `onPadOn`; a
 * recording dropped on a pad, or picked with the Sample button, goes to
 * `onDropFiles`. Controlled: every change is a callback, and the knobs report
 * the end of a turn with the commit callbacks.
 */
function DrumRackPanel({
  activeNotes,
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
  onRenamePad,
  onSelectNote,
  onUnmapMacro,
  parameters,
  rack,
  selectedNote,
  title = "Drum rack",
}: {
  /** The notes sounding now, played or held: their pads light up. */
  activeNotes?: readonly number[];
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
  /** Files dropped on the pad of `note`, or picked with the Sample button, which shows only with this: a recording to play there. */
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
  /** A new name typed for the pad `chain`; leave it out and its name is not a field. */
  onRenamePad?: (chain: string, name: string) => void;
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
  const activePads = useMemo(() => activeNotes?.map(String), [activeNotes]);
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
          activePads={activePads}
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
                  <span className="line-clamp-2 w-full break-words leading-tight">
                    {chain?.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {pitchName(note)}
                  </span>
                </PadItem>
              );
            })
          )}
        </Pad>
      </div>
      {/* Wide enough for the picked pad's line, however short its chain of devices. */}
      <div className="flex min-w-[36rem] flex-1 flex-col">
        <PadEditor
          chain={padAt(rack, selectedNote)}
          note={selectedNote}
          onChainMix={onChainMix}
          onChainMixCommit={onChainMixCommit}
          onLoadFiles={onDropFiles}
          onPadChange={onPadChange}
          onPadChoke={onPadChoke}
          onPadCommit={onPadCommit}
          onPadSound={onPadSound}
          onRemovePad={onRemovePad}
          onRenamePad={onRenamePad}
        />
        <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
      </div>
    </RackFrame>
  );
}

export { DrumRackPanel };
