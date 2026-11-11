"use client";

import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AutomatedParameter } from "@/registry-audio/bases/base/lib/arrangement";
import {
  type ArrangementEngine,
  createArrangementEngine,
  type MetronomeSettings,
} from "@/registry-audio/bases/base/lib/arrangement-engine";
import type { ArrangementDoc } from "@/registry-audio/bases/base/lib/arrangement-state";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** What the engine line shows: the context's rate, how late its sound is, and whether it runs. */
export interface EngineStatus {
  /** From the frame the engine renders to the sound leaving the speakers, in seconds: the output's latency and the delay compensation's. */
  latency: number;
  sampleRate: number;
  /** The context's state, as the browser names it: `running`, `suspended`, `closed`, or `interrupted` on some. */
  state: AudioContextState | "interrupted" | "unavailable";
}

const UNAVAILABLE: EngineStatus = {
  latency: 0,
  sampleRate: 0,
  state: "unavailable",
};

export interface UseArrangementEngineOptions {
  /** The document to play, as `useArrangement` returns it. */
  doc: ArrangementDoc;
  /** The metronome, heard in playback and never in an export. @default off */
  metronome?: MetronomeSettings;
  /** What a change by hand took from each track's automation, by track. */
  overridden?: Readonly<Record<string, readonly AutomatedParameter[]>>;
  /** The decoded recordings the audio clips name, by id. Memoize it: a new map posts every recording again. */
  recordings: ReadonlyMap<string, RecordingSource>;
}

/**
 * Plays an arrangement on the page's AudioContext through
 * `lib/arrangement-engine`: every audio clip, every note through its track's
 * instrument, every device chain, send and return, and the main track, on
 * the audio clock. The document comes in as a value and the engine follows
 * it while it plays. Returns the transport (`play`, `stop`, `playing`), the
 * playhead as a live source of seconds (what the speakers play, not what is
 * being computed), each channel's meter and tap, and the engine's status.
 */
export function useArrangementEngine({
  doc,
  metronome,
  overridden,
  recordings,
}: UseArrangementEngineOptions) {
  const [engine, setEngine] = useState<ArrangementEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<EngineStatus>(UNAVAILABLE);
  const [position] = useState(() => createSource(0));
  const latest = useRef({ doc, overridden, recordings });
  latest.current = { doc, overridden, recordings };

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    let made: ArrangementEngine | null = null;
    let cancelled = false;
    const report = () =>
      setStatus({
        latency:
          (ctx.baseLatency ?? 0) +
          (ctx.outputLatency ?? 0) +
          (made?.latency ?? 0) / ctx.sampleRate,
        sampleRate: ctx.sampleRate,
        state: ctx.state as EngineStatus["state"],
      });
    ctx.addEventListener("statechange", report);
    report();
    createArrangementEngine(ctx).then((created) => {
      if (cancelled) {
        created?.dispose();
        return;
      }
      made = created;
      if (created) {
        const {
          doc: current,
          overridden: hand,
          recordings: decoded,
        } = latest.current;
        created.update(current, decoded, hand);
      }
      setEngine(created);
      report();
    });
    return () => {
      cancelled = true;
      ctx.removeEventListener("statechange", report);
      made?.dispose();
      setEngine(null);
    };
  }, []);

  // The engine follows the document, whoever changed it.
  useEffect(() => {
    engine?.update(doc, recordings, overridden);
    const ctx = webAudio.getContext();
    if (ctx && engine) {
      setStatus((current) => ({
        ...current,
        latency:
          (ctx.baseLatency ?? 0) +
          (ctx.outputLatency ?? 0) +
          engine.latency / ctx.sampleRate,
      }));
    }
  }, [doc, engine, overridden, recordings]);

  const metronomeOn = metronome?.on ?? false;
  const metronomeRhythm = metronome?.rhythm;
  useEffect(() => {
    engine?.setMetronome({ on: metronomeOn, rhythm: metronomeRhythm });
  }, [engine, metronomeOn, metronomeRhythm]);

  // Stopped, the pages of streamed recordings a play from the cursor reads first are loaded as it moves.
  useEffect(() => {
    if (!engine || playing) {
      return;
    }
    engine.cue(position.getSnapshot());
    return position.subscribe(() => {
      engine.cue(position.getSnapshot());
    });
  }, [engine, playing, position]);

  // The playhead follows the sound each frame, without a React render; the engine stops itself at the end.
  useEffect(() => {
    if (!(engine && playing)) {
      return;
    }
    let frame = 0;
    const tick = () => {
      position.set(engine.position());
      if (!engine.playing) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, playing, position]);

  const play = useCallback(
    (from: number, at?: number) => {
      const ctx = webAudio.getContext();
      if (!(engine && ctx)) {
        return;
      }
      // Resumed in the gesture that asks to play, as browsers require.
      webAudio.resume();
      engine.play(from, at);
      position.set(from);
      setPlaying(true);
    },
    [engine, position]
  );

  const stop = useCallback(() => {
    engine?.stop();
    if (engine) {
      position.set(engine.position());
    }
    setPlaying(false);
  }, [engine, position]);

  const channel = useCallback(
    (id: string) =>
      engine
        ? ((id === doc.main.id ? engine.mixer.main : engine.mixer.strip(id)) ??
          null)
        : null,
    [doc.main.id, engine]
  );
  /** A channel's meter, one analyser per channel, by its track's id; the main track's with `main`. */
  const meter = useCallback(
    (id: string) => channel(id)?.meter ?? null,
    [channel]
  );
  /** What a channel sends on, by its track's id, for a measurement of your own such as `useLoudness`; the main track's with `main`. */
  const tap = useCallback((id: string) => channel(id)?.tap ?? null, [channel]);

  return { engine, meter, play, playing, position, status, stop, tap };
}
