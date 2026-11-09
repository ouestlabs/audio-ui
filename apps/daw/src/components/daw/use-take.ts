"use client";

import {
  secondsPerBar,
  secondsPerBeat,
  secondsPerQuarter,
} from "@audio-ui/core/time";
import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ArrangementTake } from "@/components/audio-ui/arrangement-view";
import type { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import type { Arranged } from "@/lib/arrangement";
import type {
  ArrangementCommand,
  ArrangementDoc,
} from "@/lib/arrangement-state";
import { canStream, streamRecording } from "@/lib/daw/cache";
import {
  decodeRecording,
  freshMidiClipId,
  freshRecordingId,
  type Recording,
} from "@/lib/daw/recordings";
import { canStore, saveRecording } from "@/lib/daw/storage";
import {
  createInputRecorder,
  type InputRecorder,
  playCountIn,
} from "@/lib/input-recorder";
import {
  audioTakeClip,
  blockPeak,
  midiTakeClip,
  overdubbed,
  type PlayedNote,
  type RecordedBlock,
  sliceBlocks,
  takeFrames,
} from "@/lib/recording";
import { encodeWav } from "@/lib/wav-file";
import { webAudio } from "@/lib/web-audio";
import { useSavedState } from "./use-saved-view";

/** How long a stretch each level of a take drawn live covers, in seconds. */
const LEVEL_SECONDS = 0.02;

/**
 * Levels of a take as its blocks come in: from the clock frame `gate.from`
 * on, the loudest of each `LEVEL_SECONDS`, published as they fill.
 */
function liveLevels(rate: number) {
  const list: number[] = [];
  const levels = createSource<readonly number[]>(list);
  const gate = { from: Number.POSITIVE_INFINITY };
  const span = Math.round(LEVEL_SECONDS * rate);
  let peak = 0;
  let filled = 0;
  const hear = (block: RecordedBlock) => {
    if (block.frame < gate.from) {
      return;
    }
    peak = Math.max(peak, blockPeak(block));
    filled += block.channels[0]?.length ?? 0;
    if (filled >= span) {
      list.push(peak);
      peak = 0;
      filled = 0;
      levels.set(list);
    }
  };
  return { gate, hear, levels };
}

/** How far ahead of the press a take's playback starts, in seconds: room for the input to open. */
const LEAD_SECONDS = 0.05;

/** What a take is while it runs: where playback started, what records it, the notes played. */
interface Running {
  /** What records the audio input, or null when no audio track is armed. */
  input: { recorder: InputRecorder; stream: MediaStream } | null;
  /** The input's latency plus the output's, in seconds (REC-008). */
  latency: number;
  notes: PlayedNote[];
  playAt: number;
  playFrom: number;
  tracks: { audio: string[]; midi: string[] };
}

/** Where a take stands, from Record pressed to its clips made. */
type TakePhase = "cancelled" | "finishing" | "idle" | "recording" | "starting";

/** The tracks a take records on: the armed ones, audio or MIDI. */
function armedTracks(doc: ArrangementDoc, armed: ReadonlySet<string>) {
  const audio: string[] = [];
  const midi: string[] = [];
  for (const track of doc.tracks) {
    if (armed.has(track.id)) {
      (track.kind === "midi" ? midi : audio).push(track.id);
    }
  }
  return { audio, midi };
}

/** The browser's input as a node: the stream, and its source on the context. */
interface OpenInput {
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
}

/** The browser's input, raw: echo cancellation, noise suppression and gain control are for calls, not for takes. */
async function openStream(
  ctx: AudioContext,
  deviceId: string
): Promise<OpenInput> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  });
  return { source: ctx.createMediaStreamSource(stream), stream };
}

function closeStream(input: OpenInput | null) {
  input?.source.disconnect();
  for (const track of input?.stream.getTracks() ?? []) {
    track.stop();
  }
}

/** The input's own latency, where the browser reports it, in seconds. */
const inputLatency = (stream: MediaStream | undefined) =>
  (
    stream?.getAudioTracks()[0]?.getSettings() as
      | { latency?: number }
      | undefined
  )?.latency ?? 0;

/** The audio inputs the browser offers, by id and name; names show once it has given access to one. */
export interface AudioInput {
  id: string;
  label: string;
}

/**
 * What a take kept, on the arrangement: from where playback started to where
 * it stopped, latency taken off. With the loop on, its first pass; with
 * Punch, only what falls inside the loop (REC-006). `null` when nothing.
 */
function takeRange(
  take: Running,
  stoppedAt: number,
  rate: number,
  doc: ArrangementDoc,
  punch: boolean
): readonly [number, number] | null {
  let from = take.playFrom;
  let to = take.playFrom + (stoppedAt - take.playAt) / rate - take.latency;
  if (doc.loop.on && take.playFrom < doc.loop.range[1]) {
    to = Math.min(to, doc.loop.range[1]);
    if (punch) {
      from = Math.max(from, doc.loop.range[0]);
    }
  }
  return to > from ? [from, to] : null;
}

const trackName = (doc: ArrangementDoc, id: string, fallback: string) =>
  doc.tracks.find((track) => track.id === id)?.name ?? fallback;

/** An audio take: its frames as a WAV recording of the project, kept like a dropped file, and a clip of it on each armed audio track (REC-007). */
async function audioTakeCommands(
  ctx: BaseAudioContext,
  take: Running,
  blocks: Awaited<ReturnType<InputRecorder["stop"]>>,
  [from, to]: readonly [number, number],
  doc: ArrangementDoc,
  onRecordings: (made: ReadonlyMap<string, Recording>) => void
): Promise<ArrangementCommand[]> {
  if (!take.input || take.tracks.audio.length === 0) {
    return [];
  }
  const rate = ctx.sampleRate;
  const channels = sliceBlocks(
    blocks,
    takeFrames({
      from,
      latency: take.latency,
      playAt: take.playAt,
      playFrom: take.playFrom,
      sampleRate: rate,
      to,
    }),
    2
  );
  const id = freshRecordingId(new Set());
  const bytes = encodeWav(channels, rate).buffer as ArrayBuffer;
  const decoded = await decodeRecording(ctx, bytes, "Audio take");
  if (!decoded) {
    return [];
  }
  const kept = canStream() ? await streamRecording(id, decoded) : decoded;
  if (canStore()) {
    saveRecording(id, bytes).catch(() => undefined);
  }
  onRecordings(new Map([[id, kept]]));
  return take.tracks.audio.map((track) => ({
    clip: audioTakeClip({
      id: `${id}-${track}`,
      length: to - from,
      name: trackName(doc, track, "Take"),
      recording: id,
      start: from,
      track,
    }),
    type: "add-clip" as const,
  }));
}

/** What a MIDI take does: a clip of the notes played on each armed MIDI track, or with Overdub, the notes added to the clip under its start (REC-009). */
interface MidiTakeOptions {
  overdub: boolean;
  /** Record quantization in seconds; 0 for none. */
  quantize: number;
}

/** The MIDI clip on `track` that the take's start falls in, which Overdub adds to. */
const clipUnder = (doc: ArrangementDoc, track: string, at: number) =>
  doc.clips.find(
    (clip) =>
      clip.track === track &&
      clip.notes &&
      clip.value.start <= at &&
      at < clip.value.start + clip.value.length
  );

function midiTakeCommands(
  take: Running,
  [from, to]: readonly [number, number],
  doc: ArrangementDoc,
  { overdub, quantize }: MidiTakeOptions
): ArrangementCommand[] {
  const taken = new Set(doc.clips.map((clip) => clip.id));
  return take.tracks.midi.map((track) => {
    const under = overdub ? clipUnder(doc, track, from) : undefined;
    if (under) {
      // The same clip, laid again with the notes added: one undo step, nothing else moved.
      return {
        clip: overdubbed(under, take.notes, { from, quantize, to }),
        type: "add-clip" as const,
      };
    }
    const id = freshMidiClipId(taken);
    taken.add(id);
    const clip: Arranged = midiTakeClip({
      from,
      id,
      name: trackName(doc, track, "MIDI"),
      played: take.notes,
      quantize,
      to,
      track,
    });
    return { clip, type: "add-clip" as const };
  });
}

/**
 * Recording into the arrangement (REC-004 to REC-010): Record plays from the
 * cursor, after the count-in, and records on every armed track; pressed
 * again, or on Stop, the take becomes a clip on each of them, in one undo
 * step. Audio comes from the browser's input, notes from `noteOn` and
 * `noteOff` (the MIDI input and the keys of the piano roll).
 */
export function useTake({
  cursor,
  dispatch,
  doc,
  engine,
  onRecordings,
}: {
  cursor: number;
  dispatch: (command: ArrangementCommand) => void;
  doc: ArrangementDoc;
  engine: ReturnType<typeof useArrangementEngine>;
  onRecordings: (made: ReadonlyMap<string, Recording>) => void;
}) {
  const [armed, setArmed] = useState<ReadonlySet<string>>(new Set());
  const [recording, setRecording] = useState(false);
  const [countIn, setCountIn] = useSavedState("countIn", 0);
  const [punch, setPunch] = useSavedState("punch", false);
  const [overdub, setOverdub] = useSavedState("overdub", false);
  /** Record quantization, as a share of a whole note: 0 for none. */
  const [quantize, setQuantize] = useSavedState("quantize", 0);
  /** Whether armed audio tracks play their input, for headphones (REC-003). */
  const [monitorInput, setMonitorInput] = useState(false);
  const [inputDevice, setInputDevice] = useState("");
  const [inputs, setInputs] = useState<readonly AudioInput[]>([]);
  const [live, setLive] = useState<ArrangementTake | null>(null);
  // Where a count-in stands, in negative seconds before the take; null outside one (REC-005).
  const [countdown] = useState(() => createSource<number | null>(null));
  const running = useRef<Running | null>(null);
  /**
   * Where a take stands. Starting, it waits on the context, the input and its
   * recorder, and a Stop cancels it once they answer; finishing, its recorder
   * hands over the last blocks before the input can close.
   */
  const phase = useRef<TakePhase>("idle");
  const opened = useRef<{ device: string; input: OpenInput } | null>(null);

  // Arming one disarms the others, unless Cmd or Ctrl was held (REC-001).
  const arm = useCallback((track: string, exclusive: boolean) => {
    setArmed((current) => {
      const next = new Set(exclusive ? [] : current);
      if (current.has(track)) {
        next.delete(track);
      } else {
        next.add(track);
      }
      return next;
    });
  }, []);

  /** The input, opened once and shared by monitoring and takes, on the device picked. */
  const input = useCallback(
    async (ctx: AudioContext) => {
      if (opened.current?.device !== inputDevice) {
        closeStream(opened.current?.input ?? null);
        opened.current = null;
      }
      if (!opened.current) {
        opened.current = {
          device: inputDevice,
          input: await openStream(ctx, inputDevice),
        };
      }
      return opened.current.input;
    },
    [inputDevice]
  );

  /** The audio inputs the browser offers, read again as the menu opens. */
  const refreshInputs = useCallback(async () => {
    const devices = await navigator.mediaDevices
      ?.enumerateDevices()
      .catch(() => []);
    setInputs(
      (devices ?? [])
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Input ${index + 1}`,
        }))
    );
  }, []);

  // Armed audio tracks hear their input while Monitor is on; the input closes when nothing needs it.
  const armedAudio = armedTracks(doc, armed).audio.join(" ");
  useEffect(() => {
    const engineNow = engine.engine;
    const ctx = webAudio.getContext();
    const tracks = armedAudio ? armedAudio.split(" ") : [];
    if (!(engineNow && ctx instanceof AudioContext)) {
      return;
    }
    let cancelled = false;
    if (monitorInput && tracks.length > 0) {
      input(ctx)
        .then(({ source }) => {
          if (!cancelled) {
            for (const track of tracks) {
              engineNow.monitor(track, source);
            }
          }
        })
        .catch(() =>
          toast.error("The browser gave no access to an audio input")
        );
    }
    return () => {
      cancelled = true;
      for (const track of tracks) {
        engineNow.monitor(track, null);
      }
      // A take starting or running holds the input.
      if (phase.current === "idle") {
        closeStream(opened.current?.input ?? null);
        opened.current = null;
      }
    };
  }, [armedAudio, engine.engine, input, monitorInput]);

  // The count-in, counted back to the take's start on the transport.
  const countDown = useCallback(
    (ctx: AudioContext, startsAt: number) => {
      const tick = () => {
        const left = startsAt - ctx.currentTime;
        if (left <= 0 || !running.current) {
          countdown.set(null);
          return;
        }
        countdown.set(-left);
        requestAnimationFrame(tick);
      };
      tick();
    },
    [countdown]
  );

  /** Closes the input once a take is done with it, unless Monitor still holds it. */
  const releaseInput = useCallback(() => {
    if (!monitorInput) {
      closeStream(opened.current?.input ?? null);
      opened.current = null;
    }
  }, [monitorInput]);

  const start = useCallback(async () => {
    const ctx = webAudio.getContext();
    if (!(ctx instanceof AudioContext) || phase.current !== "idle") {
      return;
    }
    phase.current = "starting";
    // Lit at once: the input can take a while to come, behind a prompt.
    setRecording(true);
    if (ctx.state !== "running") {
      await ctx.resume();
    }
    const tracks = armedTracks(doc, armed);
    const rate = ctx.sampleRate;
    const drawn = liveLevels(rate);
    let recorder: Running["input"] = null;
    if (tracks.audio.length > 0) {
      const open = await input(ctx).catch(() => null);
      const made = open ? await createInputRecorder(ctx, drawn.hear) : null;
      if (open && made) {
        open.source.connect(made.input);
        recorder = { recorder: made, stream: open.stream };
        refreshInputs();
      } else {
        toast.error("The browser gave no access to an audio input");
      }
    }
    // Read afresh: `finish` may have cancelled it while the input and the recorder came.
    if ((phase.current as TakePhase) === "cancelled") {
      // Stopped while it started: nothing plays.
      recorder?.recorder.dispose();
      releaseInput();
      phase.current = "idle";
      return;
    }
    phase.current = "recording";
    const countInSeconds = countIn * secondsPerBar(doc.tempo);
    const lead = ctx.currentTime + LEAD_SECONDS;
    if (countIn > 0) {
      playCountIn(ctx, {
        at: lead,
        beatSeconds: secondsPerBeat(doc.tempo),
        beats: countIn * doc.tempo.beatsPerBar,
        beatsPerBar: doc.tempo.beatsPerBar,
      });
    }
    running.current = {
      input: recorder,
      latency:
        ctx.baseLatency + ctx.outputLatency + inputLatency(recorder?.stream),
      notes: [],
      playAt: Math.round((lead + countInSeconds) * rate),
      playFrom: cursor,
      tracks,
    };
    // Drawn from the take's first frame on: after the count-in, the latency taken off.
    drawn.gate.from =
      running.current.playAt + Math.round(running.current.latency * rate);
    recorder?.recorder.start();
    engine.play(cursor, running.current.playAt);
    if (countIn > 0) {
      countDown(ctx, lead + countInSeconds);
    }
    setLive({
      from: cursor,
      levels: recorder ? drawn.levels : undefined,
      tracks: new Set([...tracks.audio, ...tracks.midi]),
    });
  }, [
    armed,
    countDown,
    countIn,
    cursor,
    doc,
    engine,
    input,
    refreshInputs,
    releaseInput,
  ]);

  const finish = useCallback(async () => {
    if (phase.current === "starting") {
      // `start` sees it once the input and the recorder have answered.
      phase.current = "cancelled";
      setRecording(false);
      return;
    }
    if (phase.current !== "recording") {
      return;
    }
    phase.current = "finishing";
    const take = running.current;
    const ctx = webAudio.getContext();
    running.current = null;
    countdown.set(null);
    setRecording(false);
    setLive(null);
    if (!(take && ctx)) {
      phase.current = "idle";
      return;
    }
    const stoppedAt = Math.ceil(ctx.currentTime * ctx.sampleRate);
    engine.stop();
    const blocks = take.input ? await take.input.recorder.stop() : [];
    take.input?.recorder.dispose();
    releaseInput();
    // The input is free: a new take can start while this one becomes clips.
    phase.current = "idle";
    const range = takeRange(take, stoppedAt, ctx.sampleRate, doc, punch);
    if (!range) {
      return;
    }
    const commands = [
      ...(await audioTakeCommands(ctx, take, blocks, range, doc, onRecordings)),
      ...midiTakeCommands(take, range, doc, {
        overdub,
        quantize: quantize * 4 * secondsPerQuarter(doc.tempo),
      }),
    ];
    if (commands.length > 0) {
      dispatch({ commands, type: "batch" });
    }
  }, [
    countdown,
    dispatch,
    doc,
    engine,
    onRecordings,
    overdub,
    punch,
    quantize,
    releaseInput,
  ]);

  const toggle = useCallback(() => {
    if (phase.current === "idle") {
      start();
    } else {
      finish();
    }
  }, [finish, start]);

  // Notes played while a take runs, where the speakers were (REC-009).
  const noteOn = useCallback(
    (pitch: number, velocity: number) => {
      const take = running.current;
      if (take && take.tracks.midi.length > 0 && engine.engine) {
        take.notes.push({ pitch, start: engine.engine.position(), velocity });
      }
    },
    [engine.engine]
  );
  const noteOff = useCallback(
    (pitch: number) => {
      const take = running.current;
      const held = [...(take?.notes ?? [])]
        .reverse()
        .find((note) => note.pitch === pitch && note.end === undefined);
      if (held && engine.engine) {
        held.end = engine.engine.position();
      }
    },
    [engine.engine]
  );

  return {
    arm,
    armed,
    countdown,
    countIn,
    finish,
    inputDevice,
    inputs,
    live,
    monitorInput,
    noteOff,
    noteOn,
    overdub,
    punch,
    quantize,
    recording,
    refreshInputs,
    setCountIn,
    setInputDevice,
    setMonitorInput,
    setOverdub,
    setPunch,
    setQuantize,
    toggle,
  };
}
