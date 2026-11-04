"use client";

import { secondsPerBar, secondsPerBeat } from "@audio-ui/core/time";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
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
  midiTakeClip,
  type PlayedNote,
  sliceBlocks,
  takeFrames,
} from "@/lib/recording";
import { encodeWav } from "@/lib/wav-file";
import { webAudio } from "@/lib/web-audio";

/** How far ahead of the press a take's playback starts, in seconds: room for the input to open. */
const LEAD_SECONDS = 0.05;

/** What a take is while it runs: where playback started, what records it, the notes played. */
interface Running {
  /** The audio input, or null when no audio track is armed. */
  input: {
    recorder: InputRecorder;
    source: MediaStreamAudioSourceNode;
    stream: MediaStream;
  } | null;
  /** The input's latency plus the output's, in seconds (REC-008). */
  latency: number;
  notes: PlayedNote[];
  playAt: number;
  playFrom: number;
  tracks: { audio: string[]; midi: string[] };
}

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

/** The browser's input, raw: echo cancellation, noise suppression and gain control are for calls, not for takes. */
async function openInput(ctx: AudioContext) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
    },
  });
  const recorder = await createInputRecorder(ctx);
  if (!recorder) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return null;
  }
  const source = ctx.createMediaStreamSource(stream);
  source.connect(recorder.input);
  return { recorder, source, stream };
}

function closeInput(input: Running["input"]) {
  if (!input) {
    return;
  }
  input.source.disconnect();
  input.recorder.dispose();
  for (const track of input.stream.getTracks()) {
    track.stop();
  }
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

/** A MIDI take: a clip of the notes played on each armed MIDI track (REC-009). */
function midiTakeCommands(
  take: Running,
  [from, to]: readonly [number, number],
  doc: ArrangementDoc
): ArrangementCommand[] {
  const taken = new Set(doc.clips.map((clip) => clip.id));
  return take.tracks.midi.map((track) => {
    const id = freshMidiClipId(taken);
    taken.add(id);
    const clip: Arranged = midiTakeClip({
      from,
      id,
      name: trackName(doc, track, "MIDI"),
      played: take.notes,
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
  const [countIn, setCountIn] = useState(0);
  const [punch, setPunch] = useState(false);
  const running = useRef<Running | null>(null);

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

  const start = useCallback(async () => {
    const ctx = webAudio.getContext();
    if (!(ctx instanceof AudioContext)) {
      return;
    }
    if (ctx.state !== "running") {
      await ctx.resume();
    }
    const tracks = armedTracks(doc, armed);
    const input =
      tracks.audio.length > 0
        ? await openInput(ctx).catch(() => {
            toast.error("The browser gave no access to an audio input");
            return null;
          })
        : null;
    const rate = ctx.sampleRate;
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
    const inputLatency = input?.stream.getAudioTracks()[0]?.getSettings();
    running.current = {
      input,
      latency:
        ctx.baseLatency +
        ctx.outputLatency +
        ((inputLatency as { latency?: number } | undefined)?.latency ?? 0),
      notes: [],
      playAt: Math.round((lead + countInSeconds) * rate),
      playFrom: cursor,
      tracks,
    };
    input?.recorder.start();
    engine.play(cursor, running.current.playAt);
    setRecording(true);
  }, [armed, countIn, cursor, doc, engine]);

  const finish = useCallback(async () => {
    const take = running.current;
    const ctx = webAudio.getContext();
    running.current = null;
    setRecording(false);
    if (!(take && ctx)) {
      return;
    }
    const stoppedAt = Math.ceil(ctx.currentTime * ctx.sampleRate);
    engine.stop();
    const blocks = take.input ? await take.input.recorder.stop() : [];
    closeInput(take.input);
    const range = takeRange(take, stoppedAt, ctx.sampleRate, doc, punch);
    if (!range) {
      return;
    }
    const commands = [
      ...(await audioTakeCommands(ctx, take, blocks, range, doc, onRecordings)),
      ...midiTakeCommands(take, range, doc),
    ];
    if (commands.length > 0) {
      dispatch({ commands, type: "batch" });
    }
  }, [dispatch, doc, engine, onRecordings, punch]);

  const toggle = useCallback(() => {
    if (running.current) {
      finish();
    } else {
      start();
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
    countIn,
    finish,
    noteOff,
    noteOn,
    punch,
    recording,
    setCountIn,
    setPunch,
    toggle,
  };
}
