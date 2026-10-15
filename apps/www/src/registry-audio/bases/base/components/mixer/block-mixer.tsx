"use client";

import { noteToFrequency } from "@audio-ui/core/pitch";
import { createSource, type Meter as MeterPrimitive } from "@audio-ui/react";
import { useCallback, useEffect, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useTransportClock } from "@/registry-audio/bases/base/hooks/use-transport-clock";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry-audio/bases/base/lib/drum-synthesis";

const BPM = 100;
const STEPS_PER_BEAT = 4;
const STEPS_PER_BAR = 16;
/** The fader's floor: at it, the channel is silent. */
const MIN_DB = -60;
const MAX_DB = 6;
/** How fast a gain or a pan follows its control, as a time constant in seconds. */
const RAMP = 0.01;
/** Mute and solo are filled when on, as the transport's toggles are. */
const SWITCH =
  "min-w-0 flex-1 px-0 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground";

/** Am, F, C, G, a bar each: the bass note, then the chord above it. */
const CHORDS = [
  [45, 57, 60, 64],
  [41, 53, 57, 60],
  [36, 55, 60, 64],
  [43, 55, 59, 62],
];
const TOTAL_STEPS = CHORDS.length * STEPS_PER_BAR;

interface Tone {
  /** Seconds. */
  attack: number;
  /** Low-pass corner in hertz, for a darker tone. */
  cutoff?: number;
  /** Seconds from the start to the release. */
  duration: number;
  /** Gain at the top of the attack. */
  level: number;
  /** Seconds. */
  release: number;
  type: OscillatorType;
}

/** One note: an oscillator through an envelope, scheduled at `time`. */
function playTone(
  ctx: AudioContext,
  destination: AudioNode,
  note: number,
  time: number,
  { attack, cutoff, duration, level, release, type }: Tone
) {
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = noteToFrequency(note);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, time);
  envelope.gain.linearRampToValueAtTime(level, time + attack);
  envelope.gain.setValueAtTime(level, time + duration);
  envelope.gain.linearRampToValueAtTime(0, time + duration + release);
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.frequency.value = cutoff;
    oscillator.connect(filter).connect(envelope);
  } else {
    oscillator.connect(envelope);
  }
  envelope.connect(destination);
  oscillator.start(time);
  oscillator.stop(time + duration + release);
}

interface Track {
  /** Fader position in dB. */
  gain: number;
  id: string;
  label: string;
  /** From -1 (left) to 1 (right). */
  pan: number;
  /** Schedules the track's part for one sixteenth: `step` within the bar, `chord` the bar's. */
  play: (
    ctx: AudioContext,
    destination: AudioNode,
    step: number,
    chord: readonly number[],
    time: number,
    secondsPerStep: number
  ) => void;
}

const playDrums: Track["play"] = (ctx, destination, step, _chord, time) => {
  if (step % 8 === 0 || step === 10) {
    triggerKick(ctx, destination, time);
  }
  if (step % 8 === 4) {
    triggerSnare(ctx, destination, time);
  }
  if (step % 2 === 0) {
    const hat = ctx.createGain();
    hat.gain.value = step % 4 === 2 ? 0.6 : 0.35;
    hat.connect(destination);
    triggerHihat(ctx, hat, time);
  }
};

/** Eighths on the root, up an octave on the last of each beat pair. */
const playBass: Track["play"] = (ctx, destination, step, chord, time, spb) => {
  if (step % 2 !== 0) {
    return;
  }
  const root = chord[0] ?? 0;
  playTone(ctx, destination, step % 8 === 6 ? root + 12 : root, time, {
    attack: 0.005,
    cutoff: 700,
    duration: spb * 1.6,
    level: 0.5,
    release: 0.05,
    type: "sawtooth",
  });
};

/** Short chords on the offbeats. */
const playKeys: Track["play"] = (ctx, destination, step, chord, time) => {
  if (step % 4 !== 2) {
    return;
  }
  for (const note of chord.slice(1)) {
    playTone(ctx, destination, note + 12, time, {
      attack: 0.005,
      duration: 0.06,
      level: 0.2,
      release: 0.12,
      type: "triangle",
    });
  }
};

/** The chord held for the bar, fading in. */
const playPad: Track["play"] = (ctx, destination, step, chord, time, spb) => {
  if (step !== 0) {
    return;
  }
  for (const note of chord.slice(1)) {
    playTone(ctx, destination, note, time, {
      attack: 0.4,
      cutoff: 1800,
      duration: spb * STEPS_PER_BAR - 0.4,
      level: 0.12,
      release: 0.4,
      type: "sawtooth",
    });
  }
};

const TRACKS: Track[] = [
  { gain: 0, id: "drums", label: "Drums", pan: 0, play: playDrums },
  { gain: -4, id: "bass", label: "Bass", pan: 0, play: playBass },
  { gain: -6, id: "keys", label: "Keys", pan: -0.3, play: playKeys },
  { gain: -9, id: "pad", label: "Pad", pan: 0.3, play: playPad },
];

const dbToGain = (db: number) => (db <= MIN_DB ? 0 : 10 ** (db / 20));
const formatDb = (db: number) => {
  if (db <= MIN_DB) {
    return "-∞";
  }
  return `${db > 0 ? "+" : ""}${db.toFixed(1)}`;
};
const formatVolume = (db: number) => `${formatDb(db)} dB`;
const formatPan = (pan: number) => {
  const amount = Math.round(Math.abs(pan) * 100);
  if (amount === 0) {
    return "C";
  }
  return `${pan < 0 ? "L" : "R"}${amount}`;
};

/** The nodes of one channel: what plays into `input` comes out of `output` into the master. */
interface ChannelNodes {
  analysers: AnalyserNode[];
  fader: GainNode;
  input: GainNode;
  mute: GainNode;
  panner: StereoPannerNode;
}

function createChannel(ctx: AudioContext, output: AudioNode): ChannelNodes {
  const input = ctx.createGain();
  const fader = ctx.createGain();
  const mute = ctx.createGain();
  const panner = ctx.createStereoPanner();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  input.connect(fader).connect(mute).connect(panner).connect(output);
  // The meter reads the channel after its fader and its mute, as it plays into the mix.
  mute.connect(analyser);
  return { analysers: [analyser], fader, input, mute, panner };
}

const SILENT_MONO = createSource<MeterPrimitive.Root.Frame>({
  levels: [-100],
});
const SILENT_STEREO = createSource<MeterPrimitive.Root.Frame>({
  levels: [-100, -100],
});
const NO_ANALYSERS: AnalyserNode[] = [];

function ChannelMeter({
  analysers,
  label,
  stereo = false,
}: {
  analysers: AnalyserNode[] | undefined;
  label: string;
  stereo?: boolean;
}) {
  const levels = useAudioLevels(analysers ?? NO_ANALYSERS);
  const silent = stereo ? SILENT_STEREO : SILENT_MONO;
  return (
    <Meter
      aria-label={`${label} level`}
      className="data-[orientation=vertical]:h-full"
      peakMarks="hidden"
      size="sm"
      source={analysers ? levels : silent}
      warnThreshold={-12}
    />
  );
}

/** A channel's fader and its meter side by side, the value under them. */
function ChannelLevel({
  analysers,
  gain,
  label,
  onGainChange,
  stereo,
}: {
  analysers: AnalyserNode[] | undefined;
  gain: number;
  label: string;
  onGainChange: (gain: number) => void;
  stereo?: boolean;
}) {
  return (
    <>
      <div className="flex h-44 justify-center gap-1.5">
        <Fader
          aria-label={`${label} volume`}
          formatValue={formatVolume}
          largeStep={6}
          max={MAX_DB}
          min={MIN_DB}
          onValueChange={onGainChange}
          size="sm"
          step={0.5}
          thumbMarks={1}
          value={gain}
          valueLabel="hidden"
        />
        <ChannelMeter analysers={analysers} label={label} stereo={stereo} />
      </div>
      <span
        aria-hidden="true"
        className="text-muted-foreground text-xs tabular-nums"
      >
        {formatDb(gain)}
      </span>
    </>
  );
}

interface ChannelState {
  gain: number;
  muted: boolean;
  pan: number;
  soloed: boolean;
}

function Channel({
  index,
  nodes,
  onChange,
  state,
  track,
}: {
  index: number;
  nodes: ChannelNodes | undefined;
  onChange: (index: number, change: Partial<ChannelState>) => void;
  state: ChannelState;
  track: Track;
}) {
  const setGain = useCallback(
    (gain: number) => onChange(index, { gain }),
    [index, onChange]
  );
  const setPan = useCallback(
    (pan: number) => onChange(index, { pan }),
    [index, onChange]
  );
  const setMuted = useCallback(
    (muted: boolean) => onChange(index, { muted }),
    [index, onChange]
  );
  const setSoloed = useCallback(
    (soloed: boolean) => onChange(index, { soloed }),
    [index, onChange]
  );
  return (
    <div
      aria-label={track.label}
      className="row-span-5 grid min-w-0 grid-rows-subgrid justify-items-center"
      role="group"
    >
      <Knob
        anchor={0}
        aria-label={`${track.label} pan`}
        defaultValue={track.pan}
        formatValue={formatPan}
        largeStep={0.25}
        max={1}
        min={-1}
        onValueChange={setPan}
        size="sm"
        step={0.01}
        value={state.pan}
        valueLabel="always"
      />
      <ChannelLevel
        analysers={nodes?.analysers}
        gain={state.gain}
        label={track.label}
        onGainChange={setGain}
      />
      <div className="flex w-full gap-1">
        <Toggle
          aria-label={`Mute ${track.label}`}
          className={SWITCH}
          onPressedChange={setMuted}
          pressed={state.muted}
          size="sm"
          variant="outline"
        >
          M
        </Toggle>
        <Toggle
          aria-label={`Solo ${track.label}`}
          className={SWITCH}
          onPressedChange={setSoloed}
          pressed={state.soloed}
          size="sm"
          variant="outline"
        >
          S
        </Toggle>
      </div>
      <span className="max-w-full truncate text-xs">{track.label}</span>
    </div>
  );
}

const INITIAL_CHANNELS: ChannelState[] = TRACKS.map((track) => ({
  gain: track.gain,
  muted: false,
  pan: track.pan,
  soloed: false,
}));

/**
 * A mixing console: four tracks of a loop, each with its pan, its fader and
 * its meter, mute and solo, into a master with a stereo meter. Every meter
 * reads the real signal of its channel.
 */
export default function BlockMixer() {
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [masterGain, setMasterGain] = useState(0);
  const webAudio = useWebAudio();
  const master = useMasterBus(dbToGain(masterGain));
  const [nodes, setNodes] = useState<ChannelNodes[] | null>(null);
  const [masterAnalysers, setMasterAnalysers] = useState<AnalyserNode[]>();

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && master)) {
      return;
    }
    const created = TRACKS.map(() => createChannel(ctx, master));
    // The master's meter reads its two sides after its fader.
    const splitter = ctx.createChannelSplitter(2);
    master.connect(splitter);
    const sides = [0, 1].map((side) => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      splitter.connect(analyser, side);
      return analyser;
    });
    setNodes(created);
    setMasterAnalysers(sides);
    return () => {
      for (const channel of created) {
        channel.input.disconnect();
        channel.panner.disconnect();
      }
      splitter.disconnect();
      setNodes(null);
      setMasterAnalysers(undefined);
    };
  }, [master, webAudio]);

  // A soloed channel silences every channel that is not.
  const anySoloed = channels.some((channel) => channel.soloed);
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && nodes)) {
      return;
    }
    channels.forEach((channel, index) => {
      const node = nodes[index];
      if (!node) {
        return;
      }
      const audible = !channel.muted && (channel.soloed || !anySoloed);
      node.fader.gain.setTargetAtTime(
        dbToGain(channel.gain),
        ctx.currentTime,
        RAMP
      );
      node.mute.gain.setTargetAtTime(audible ? 1 : 0, ctx.currentTime, RAMP);
      node.panner.pan.setTargetAtTime(channel.pan, ctx.currentTime, RAMP);
    });
  }, [anySoloed, channels, nodes, webAudio]);

  const playStep = useCallback(
    (step: number, time: number) => {
      const ctx = webAudio.getContext();
      if (!(ctx && nodes)) {
        return;
      }
      const chord = CHORDS[Math.floor(step / STEPS_PER_BAR)] ?? [];
      const secondsPerStep = 60 / BPM / STEPS_PER_BEAT;
      TRACKS.forEach((track, index) => {
        const input = nodes[index]?.input;
        if (input) {
          track.play(
            ctx,
            input,
            step % STEPS_PER_BAR,
            chord,
            time,
            secondsPerStep
          );
        }
      });
    },
    [nodes, webAudio]
  );
  const { isPlaying, start, stop } = useTransportClock({
    bpm: BPM,
    onStep: playStep,
    stepsPerBeat: STEPS_PER_BEAT,
    totalSteps: TOTAL_STEPS,
  });
  const toggle = useCallback(() => {
    if (isPlaying) {
      stop();
      return;
    }
    const ctx = webAudio.getContext();
    if (ctx?.state === "suspended") {
      ctx.resume();
    }
    start();
  }, [isPlaying, start, stop, webAudio]);

  const change = useCallback(
    (index: number, update: Partial<ChannelState>) =>
      setChannels((current) =>
        current.map((channel, at) =>
          at === index ? { ...channel, ...update } : channel
        )
      ),
    []
  );

  return (
    <div className="cn-audio-panel @container/panel w-full min-w-0 border bg-card p-4">
      <div className="mx-auto grid w-full max-w-md grid-cols-[repeat(4,minmax(0,1fr))_minmax(min-content,1fr)] gap-2">
        {TRACKS.map((track, index) => (
          <Channel
            index={index}
            key={track.id}
            nodes={nodes?.[index]}
            onChange={change}
            state={channels[index] ?? INITIAL_CHANNELS[0]}
            track={track}
          />
        ))}
        <div
          aria-label="Master"
          className="row-span-5 grid min-w-0 grid-rows-subgrid justify-items-center border-s ps-2"
          role="group"
        >
          <Button
            aria-label={isPlaying ? "Stop" : "Play"}
            onClick={toggle}
            size="icon"
          >
            {isPlaying ? (
              <IconPlaceholder
                hugeicons="StopIcon"
                lucide="SquareIcon"
                phosphor="StopIcon"
                remixicon="RiStopFill"
                tabler="IconPlayerStopFilled"
              />
            ) : (
              <IconPlaceholder
                hugeicons="PlayIcon"
                lucide="PlayIcon"
                phosphor="PlayIcon"
                remixicon="RiPlayFill"
                tabler="IconPlayerPlayFilled"
              />
            )}
          </Button>
          <ChannelLevel
            analysers={masterAnalysers}
            gain={masterGain}
            label="Master"
            onGainChange={setMasterGain}
            stereo
          />
          <div />
          <span className="text-xs">Master</span>
        </div>
      </div>
    </div>
  );
}
