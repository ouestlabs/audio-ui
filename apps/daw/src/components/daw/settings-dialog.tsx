"use client";

import {
  gridLabel,
  METRONOME_RHYTHMS,
  type MetronomeRhythm,
  metronomeRhythmSeconds,
  type Tempo,
} from "@audio-ui/core/time";
import {
  type Hotkey,
  matchesKeyboardEvent,
  useAppHotkeyList,
  useAppHotkeys,
  useCustomHotkeys,
  useHotkeyRecorder,
} from "@tanstack/react-hotkeys";
import { useTheme } from "next-themes";
import { type ReactNode, useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { EngineStatus } from "@/hooks/use-arrangement-engine";
import { useMidiInput } from "@/hooks/use-midi-input";
import {
  canPickOutput,
  keepSettings,
  LATENCIES,
  type Latency,
  playOn,
  readSettings,
} from "@/lib/daw/settings";
import { ALSO_HOTKEYS, type ShortcutCommand } from "@/lib/daw/shortcuts";
import { RECORD_QUANTIZE } from "@/lib/recording";
import { HotkeyKeys } from "./shortcut-list";
import type { AudioInput } from "./use-take";

const SECTIONS = ["General", "Audio", "MIDI", "Record", "Shortcuts"] as const;

const THEMES = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

const COUNT_INS = [
  { label: "None", value: "0" },
  { label: "1 bar", value: "1" },
  { label: "2 bars", value: "2" },
  { label: "4 bars", value: "4" },
];

const QUANTIZE_LABELS: Record<number, string> = {
  0: "None",
  0.03125: "1/32",
  0.0625: "1/16",
  0.125: "1/8",
  0.25: "1/4",
};
const QUANTIZES = RECORD_QUANTIZE.map((share) => ({
  label: QUANTIZE_LABELS[share] ?? String(share),
  value: String(share),
}));

const SYSTEM_OUTPUT = "system";

/** The id of a row's description, which its control is described by. */
const hintOf = (id: string) => `${id}-hint`;

/** A setting: its name and what it does on the left, its control on the right. */
function Row({
  children,
  description,
  id,
  label,
}: {
  children: ReactNode;
  description?: ReactNode;
  /** The control's id, so the name labels it; its description is `hintOf(id)`, for the control's `aria-describedby`. */
  id?: string;
  label: string;
}) {
  return (
    // Wraps where it is narrow: the control goes under its name rather than over it.
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2">
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
        <label className="font-medium text-sm" htmlFor={id}>
          {label}
        </label>
        {description ? (
          <p
            className="text-muted-foreground text-xs"
            id={id ? hintOf(id) : undefined}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 max-w-full items-center gap-2">
        {children}
      </div>
    </div>
  );
}

/** A pick from a short list, as a select: its items by value and label. */
function Pick({
  described,
  disabled,
  id,
  items,
  onValueChange,
  value,
}: {
  /** Whether its row has a description, which then describes it. */
  described?: boolean;
  disabled?: boolean;
  id: string;
  items: readonly { label: string; value: string }[];
  onValueChange: (value: string) => void;
  value: string;
}) {
  const pick = useCallback(
    (next: string | null) => {
      if (next !== null) {
        onValueChange(next);
      }
    },
    [onValueChange]
  );
  return (
    <Select
      disabled={disabled}
      items={items}
      onValueChange={pick}
      value={value}
    >
      <SelectTrigger
        aria-describedby={described ? hintOf(id) : undefined}
        className="w-48 max-w-full"
        id={id}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function GeneralSection() {
  const { setTheme, theme = "system" } = useTheme();
  const id = useId();
  const pick = useCallback(
    (values: unknown[]) => {
      const [next] = values;
      if (typeof next === "string") {
        setTheme(next);
      }
    },
    [setTheme]
  );
  return (
    <Row id={id} label="Theme">
      <ToggleGroup
        aria-label="Theme"
        className="flex-wrap"
        id={id}
        onValueChange={pick}
        size="sm"
        value={[theme]}
        variant="outline"
      >
        {THEMES.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Row>
  );
}

/** The outputs the browser offers: their names once it has given access to a microphone. */
function useOutputs(open: boolean) {
  const [outputs, setOutputs] = useState<readonly AudioInput[]>([]);
  useEffect(() => {
    if (!(open && navigator.mediaDevices?.enumerateDevices)) {
      return;
    }
    const read = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) =>
          setOutputs(
            devices
              .filter(
                (device) =>
                  device.kind === "audiooutput" && device.deviceId !== "default"
              )
              .map((device, index) => ({
                id: device.deviceId,
                label: device.label || `Output ${index + 1}`,
              }))
          )
        )
        .catch(() => setOutputs([]));
    read();
    navigator.mediaDevices.addEventListener("devicechange", read);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", read);
  }, [open]);
  return outputs;
}

export interface AudioSettingsProps {
  inputDevice: string;
  inputs: readonly AudioInput[];
  monitorInput: boolean;
  onInputDeviceChange: (device: string) => void;
  onMonitorInputChange: (on: boolean) => void;
  /** Reads the inputs the browser offers again, as the settings open. */
  onReadInputs: () => void;
  status: EngineStatus;
}

function AudioSection({
  inputDevice,
  inputs,
  monitorInput,
  onInputDeviceChange,
  onMonitorInputChange,
  onReadInputs,
  open,
  status,
}: AudioSettingsProps & { open: boolean }) {
  const id = useId();
  useEffect(() => {
    if (open) {
      onReadInputs();
    }
  }, [onReadInputs, open]);
  const outputs = useOutputs(open);
  const [output, setOutput] = useState(() => readSettings().output);
  const [latency, setLatency] = useState(() => readSettings().latency);
  // The latency the context runs with: a new one takes the next load.
  const [running] = useState(latency);
  const pickOutput = useCallback((value: string) => {
    const device = value === SYSTEM_OUTPUT ? "" : value;
    setOutput(device);
    keepSettings({ output: device });
    playOn(device);
  }, []);
  const pickLatency = useCallback((value: string) => {
    setLatency(value as Latency);
    keepSettings({ latency: value as Latency });
  }, []);
  const reload = useCallback(() => window.location.reload(), []);
  const routable = canPickOutput();
  return (
    <>
      <Row
        description={
          routable ? undefined : "This browser plays on the system's output."
        }
        id={`${id}-output`}
        label="Output"
      >
        <Pick
          described={!routable}
          disabled={!routable}
          id={`${id}-output`}
          items={[
            { label: "System output", value: SYSTEM_OUTPUT },
            ...outputs.map((item) => ({ label: item.label, value: item.id })),
          ]}
          onValueChange={pickOutput}
          value={output || SYSTEM_OUTPUT}
        />
      </Row>
      <Row
        description={
          inputs.length === 0
            ? "Listed once the browser lets the workstation use a microphone. Record on an audio track to allow it."
            : undefined
        }
        id={`${id}-input`}
        label="Input"
      >
        <Pick
          described={inputs.length === 0}
          disabled={inputs.length === 0}
          id={`${id}-input`}
          items={[
            { label: "Default input", value: "" },
            ...inputs.map((item) => ({ label: item.label, value: item.id })),
          ]}
          onValueChange={onInputDeviceChange}
          value={inputDevice}
        />
      </Row>
      <Row
        description="Hear the input through the armed track as you record."
        id={`${id}-monitor`}
        label="Monitor the input"
      >
        <Switch
          aria-describedby={hintOf(`${id}-monitor`)}
          checked={monitorInput}
          id={`${id}-monitor`}
          onCheckedChange={onMonitorInputChange}
        />
      </Row>
      <Row
        description={
          latency === running ? (
            LATENCIES.find((item) => item.value === latency)?.description
          ) : (
            <>
              Takes effect when the workstation loads again.{" "}
              <Button
                className="h-auto p-0 text-xs"
                onClick={reload}
                variant="link"
              >
                Reload now
              </Button>
            </>
          )
        }
        id={`${id}-latency`}
        label="Latency"
      >
        <Pick
          described
          id={`${id}-latency`}
          items={LATENCIES}
          onValueChange={pickLatency}
          value={latency}
        />
      </Row>
      {status.sampleRate > 0 ? (
        <p className="pt-2 text-muted-foreground text-xs tabular-nums">
          {(status.sampleRate / 1000).toFixed(1)} kHz,{" "}
          {(status.latency * 1000).toFixed(1)} ms from a frame to the speakers.
        </p>
      ) : null}
    </>
  );
}

function MidiDevice({
  muted,
  name,
  onEnabledChange,
}: {
  muted: boolean;
  name: string;
  onEnabledChange: (name: string, enabled: boolean) => void;
}) {
  const id = useId();
  const change = useCallback(
    (on: boolean) => onEnabledChange(name, on),
    [name, onEnabledChange]
  );
  return (
    <Row id={id} label={name}>
      <Switch checked={!muted} id={id} onCheckedChange={change} />
    </Row>
  );
}

export interface MidiSettingsProps {
  computerKeys: boolean;
  onComputerKeysChange: (on: boolean) => void;
}

function MidiSection({
  computerKeys,
  onComputerKeysChange,
}: MidiSettingsProps) {
  const id = useId();
  const midi = useMidiInput();
  const { setInputEnabled } = midi;
  const enable = useCallback(
    (name: string, enabled: boolean) => {
      setInputEnabled(name, enabled);
      const muted = new Set(readSettings().mutedMidi);
      if (enabled) {
        muted.delete(name);
      } else {
        muted.add(name);
      }
      keepSettings({ mutedMidi: [...muted] });
    },
    [setInputEnabled]
  );
  let devices: ReactNode;
  if (!midi.isSupported) {
    devices = (
      <p className="py-2 text-muted-foreground text-sm">
        This browser has no Web MIDI.
      </p>
    );
  } else if (midi.isConnected) {
    devices = midi.inputNames.map((name) => (
      <MidiDevice
        key={name}
        muted={midi.mutedInputs.includes(name)}
        name={name}
        onEnabledChange={enable}
      />
    ));
  } else {
    devices = (
      <Row
        description={
          midi.error ?? "The browser asks before it lets the page hear them."
        }
        id={`${id}-connect`}
        label="MIDI devices"
      >
        <Button
          aria-describedby={hintOf(`${id}-connect`)}
          id={`${id}-connect`}
          onClick={midi.requestAccess}
          size="sm"
          variant="outline"
        >
          Connect
        </Button>
      </Row>
    );
  }
  return (
    <>
      <h3 className="pt-1 font-medium text-muted-foreground text-xs">
        Devices
      </h3>
      {devices}
      <h3 className="pt-4 font-medium text-muted-foreground text-xs">
        Computer keyboard
      </h3>
      <Row
        description="Letter keys play notes on the armed MIDI tracks."
        id={id}
        label="Play with the keyboard"
      >
        <Switch
          aria-describedby={hintOf(id)}
          checked={computerKeys}
          id={id}
          onCheckedChange={onComputerKeysChange}
        />
      </Row>
    </>
  );
}

export interface RecordSettingsSectionProps {
  countIn: number;
  metronome: boolean;
  onCountInChange: (bars: number) => void;
  onMetronomeChange: (on: boolean) => void;
  onOverdubChange: (on: boolean) => void;
  onQuantizeChange: (share: number) => void;
  onRhythmChange: (rhythm: MetronomeRhythm) => void;
  overdub: boolean;
  quantize: number;
  rhythm: MetronomeRhythm;
  tempo: Tempo;
}

function RecordSection({
  countIn,
  metronome,
  onCountInChange,
  onMetronomeChange,
  onOverdubChange,
  onQuantizeChange,
  onRhythmChange,
  overdub,
  quantize,
  rhythm,
  tempo,
}: RecordSettingsSectionProps) {
  const id = useId();
  const pickCountIn = useCallback(
    (value: string) => onCountInChange(Number(value)),
    [onCountInChange]
  );
  const pickQuantize = useCallback(
    (value: string) => onQuantizeChange(Number(value)),
    [onQuantizeChange]
  );
  const pickRhythm = useCallback(
    (value: string) => onRhythmChange(value as MetronomeRhythm),
    [onRhythmChange]
  );
  const rhythms = METRONOME_RHYTHMS.map((item) => {
    const seconds = metronomeRhythmSeconds(item.id, tempo);
    return {
      label: seconds === null ? "Auto" : gridLabel(seconds, tempo),
      value: item.id,
    };
  });
  return (
    <>
      <Row
        description="Bars the metronome counts before recording starts."
        id={`${id}-count`}
        label="Count-in"
      >
        <Pick
          described
          id={`${id}-count`}
          items={COUNT_INS}
          onValueChange={pickCountIn}
          value={String(countIn)}
        />
      </Row>
      <Row id={`${id}-metronome`} label="Metronome">
        <Switch
          checked={metronome}
          id={`${id}-metronome`}
          onCheckedChange={onMetronomeChange}
        />
      </Row>
      <Row
        description="What it clicks on: Auto follows the time signature."
        id={`${id}-rhythm`}
        label="Metronome rhythm"
      >
        <Pick
          described
          id={`${id}-rhythm`}
          items={rhythms}
          onValueChange={pickRhythm}
          value={rhythm}
        />
      </Row>
      <Row
        description="A MIDI take adds its notes to the clip it records over."
        id={`${id}-overdub`}
        label="MIDI overdub"
      >
        <Switch
          aria-describedby={hintOf(`${id}-overdub`)}
          checked={overdub}
          id={`${id}-overdub`}
          onCheckedChange={onOverdubChange}
        />
      </Row>
      <Row
        description="Where a recorded note starts, moved to the nearest step."
        id={`${id}-quantize`}
        label="Record quantize"
      >
        <Pick
          described
          id={`${id}-quantize`}
          items={QUANTIZES}
          onValueChange={pickQuantize}
          value={String(quantize)}
        />
      </Row>
    </>
  );
}

/** A command's keys, as a button: pressed, it records the next keys pressed, Escape cancels. */
function ShortcutRow({
  custom,
  hotkey,
  id,
  name,
  onRecordingChange,
}: {
  custom: boolean;
  hotkey: Hotkey | null;
  id: ShortcutCommand;
  name: string;
  onRecordingChange: (recording: boolean) => void;
}) {
  const { resetCustomHotkey, setCustomHotkey } = useCustomHotkeys();
  const appHotkeys = useAppHotkeys();
  const [problem, setProblem] = useState<string | null>(null);
  const recorder = useHotkeyRecorder({
    onCancel: () => setProblem(null),
    onClear: () => {
      setProblem(null);
      setCustomHotkey(id, null);
    },
    onRecord: (recorded) => {
      setProblem(null);
      setCustomHotkey(id, recorded);
    },
    onReject: (rejection) => setProblem(rejection.message),
    // Keys another command answers, written by the key or by its place on the keyboard, stay its own.
    validate: (_recorded, context) => {
      if (context.kind !== "chord") {
        return true;
      }
      const taken = [
        ...Object.values(appHotkeys).map((item) => ({
          command: item.id,
          hotkey: item.hotkey,
        })),
        ...ALSO_HOTKEYS,
      ].find(
        (item) =>
          item.command !== id &&
          typeof item.hotkey === "string" &&
          matchesKeyboardEvent(context.event, item.hotkey)
      );
      return taken
        ? `${appHotkeys[taken.command]?.meta?.name ?? taken.command} already uses these keys. Press others, or Escape.`
        : true;
    },
  });
  const { isRecording, startRecording } = recorder;
  useEffect(() => {
    onRecordingChange(isRecording);
    return () => onRecordingChange(false);
  }, [isRecording, onRecordingChange]);
  const reset = useCallback(() => {
    setProblem(null);
    resetCustomHotkey(id);
  }, [id, resetCustomHotkey]);
  const nameId = useId();
  const keysId = useId();
  const problemId = useId();
  let keys: ReactNode = <span className="text-muted-foreground">None</span>;
  if (isRecording) {
    keys = <span className="text-muted-foreground">Press keys…</span>;
  } else if (hotkey) {
    keys = <HotkeyKeys hotkey={hotkey} />;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1">
      <span className="min-w-0 flex-1 basis-40 text-sm" id={nameId}>
        {name}
      </span>
      <span className="flex min-w-0 flex-wrap items-center justify-end gap-1">
        {/* Always there, so a refusal is read as it comes: what the keys belong to, and what to do. */}
        <span className="text-destructive text-xs" id={problemId} role="status">
          {problem}
        </span>
        <Button
          aria-describedby={problemId}
          aria-labelledby={`${nameId} ${keysId}`}
          aria-pressed={isRecording}
          className="min-w-28 justify-center"
          id={keysId}
          onClick={startRecording}
          size="sm"
          variant="outline"
        >
          {keys}
        </Button>
        <Button
          aria-label={`Reset ${name}`}
          className="text-muted-foreground"
          disabled={!custom}
          onClick={reset}
          size="sm"
          variant="ghost"
        >
          Reset
        </Button>
      </span>
    </div>
  );
}

function ShortcutsSection({
  onRecordingChange,
}: {
  onRecordingChange: (recording: boolean) => void;
}) {
  const items = useAppHotkeyList();
  const { customHotkeys, resetCustomHotkeys, setCustomHotkey } =
    useCustomHotkeys();
  // Every key of the user's own goes back to its default, and Undo in the toast brings them all back.
  const resetAll = useCallback(() => {
    const kept = Object.entries(customHotkeys) as [
      ShortcutCommand,
      Hotkey | null,
    ][];
    resetCustomHotkeys();
    toast("Shortcuts reset", {
      action: {
        label: "Undo",
        onClick: () => {
          for (const [command, hotkey] of kept) {
            setCustomHotkey(command, hotkey);
          }
        },
      },
    });
  }, [customHotkeys, resetCustomHotkeys, setCustomHotkey]);
  const groups = [...new Set(items.map((item) => item.appHotkey.meta?.group))];
  return (
    <>
      <div className="flex items-center justify-between gap-4 pb-2">
        <p className="text-muted-foreground text-xs">
          Press a command's keys to change them. Escape cancels, Delete leaves
          it without keys.
        </p>
        <Button
          disabled={Object.keys(customHotkeys).length === 0}
          onClick={resetAll}
          size="sm"
          variant="outline"
        >
          Reset all
        </Button>
      </div>
      {groups.map((group) => (
        <section aria-label={group} className="flex flex-col pb-3" key={group}>
          <h3 className="pb-1 font-medium text-muted-foreground text-xs">
            {group}
          </h3>
          {items
            .filter((item) => item.appHotkey.meta?.group === group)
            .map(({ appHotkey }) => (
              <ShortcutRow
                custom={appHotkey.id in customHotkeys}
                hotkey={appHotkey.hotkey ?? null}
                id={appHotkey.id}
                key={appHotkey.id}
                name={appHotkey.meta?.name ?? appHotkey.id}
                onRecordingChange={onRecordingChange}
              />
            ))}
        </section>
      ))}
    </>
  );
}

/**
 * A section's panel: it scrolls, and fades where more follows. The fade is a
 * scroll-driven animation, which never ends, so it sits on a box inside: on
 * the panel, the tabs would wait for it before letting the panel go.
 */
function SettingsPanel({
  children,
  value,
}: {
  children: ReactNode;
  value: string;
}) {
  return (
    <TabsContent className="flex min-h-0 min-w-0" value={value}>
      <div className="scroll-fade min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">
        {children}
      </div>
    </TabsContent>
  );
}

export interface SettingsDialogProps {
  audio: AudioSettingsProps;
  midi: MidiSettingsProps;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  record: RecordSettingsSectionProps;
}

/**
 * The workstation's settings, kept in this browser: the theme; the audio
 * output, input and latency; the MIDI devices and the computer's keyboard;
 * recording; and the keyboard shortcuts, each rebound by pressing its new
 * keys. Mounted closed too, so the output and the MIDI devices kept apply as
 * the workstation opens.
 */
export function SettingsDialog({
  audio,
  midi,
  onOpenChange,
  open,
  record,
}: SettingsDialogProps) {
  const [section, setSection] = useState<string>(SECTIONS[0]);
  const [recording, setRecording] = useState(false);
  const { setInputEnabled } = useMidiInput();
  // What was kept applies as the workstation opens: the output it plays on, the MIDI devices switched off.
  useEffect(() => {
    const kept = readSettings();
    if (kept.output) {
      playOn(kept.output);
    }
    for (const name of kept.mutedMidi) {
      setInputEnabled(name, false);
    }
  }, [setInputEnabled]);
  // Escape while keys are recorded cancels them, and leaves the dialog open.
  const change = useCallback(
    (next: boolean) => {
      if (next || !recording) {
        onOpenChange(next);
      }
    },
    [onOpenChange, recording]
  );
  const pickSection = useCallback(
    (value: unknown) => setSection(String(value)),
    []
  );
  return (
    <Dialog onOpenChange={change} open={open}>
      <DialogContent className="flex h-[min(36rem,85svh)] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Kept in this browser, for every project.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          className="min-h-0 flex-1 gap-0"
          onValueChange={pickSection}
          orientation="vertical"
          value={section}
        >
          <TabsList
            className="w-28 shrink-0 items-stretch justify-start gap-1 rounded-none border-e py-2 ps-2 pe-1 group-data-vertical/tabs:h-full sm:w-40"
            variant="line"
          >
            {SECTIONS.map((item) => (
              <TabsTrigger className="h-8 flex-none" key={item} value={item}>
                {item}
              </TabsTrigger>
            ))}
          </TabsList>
          <SettingsPanel value="General">
            <GeneralSection />
          </SettingsPanel>
          <SettingsPanel value="Audio">
            <AudioSection {...audio} open={open} />
          </SettingsPanel>
          <SettingsPanel value="MIDI">
            <MidiSection {...midi} />
          </SettingsPanel>
          <SettingsPanel value="Record">
            <RecordSection {...record} />
          </SettingsPanel>
          <SettingsPanel value="Shortcuts">
            <ShortcutsSection onRecordingChange={setRecording} />
          </SettingsPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
