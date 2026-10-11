"use client";

import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import {
  DEFAULT_TEMPO,
  type MetronomeRhythm,
  secondsPerBar,
  type Tempo,
} from "@/registry-audio/bases/base/lib/musical-time";

const LOOP_BARS = 4;

/** The transport of a DAW, with a clock standing in for the engine: play or pause, stop, loop four bars, tick the metronome (and pick how often it clicks), and change the tempo or the signature. */
export default function TransportDemo() {
  const [position] = useState(() => createSource(0));
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(true);
  const [metronome, setMetronome] = useState(true);
  const [rhythm, setRhythm] = useState<MetronomeRhythm>("auto");
  const [tempo, setTempo] = useState<Tempo>(DEFAULT_TEMPO);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const loopEnd = LOOP_BARS * secondsPerBar(tempo);
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      let next = position.getSnapshot() + (now - last) / 1000;
      last = now;
      if (looping && next >= loopEnd) {
        next %= loopEnd;
      }
      position.set(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [looping, playing, position, tempo]);

  const playPause = useCallback(() => setPlaying((on) => !on), []);
  // Stop goes back to the top, as a DAW's does.
  const stop = useCallback(() => {
    setPlaying(false);
    position.set(0);
  }, [position]);

  return (
    <div className="w-full">
      <Transport
        looping={looping}
        metronome={metronome}
        onLoopingChange={setLooping}
        onMetronomeChange={setMetronome}
        onPlayPause={playPause}
        onRhythmChange={setRhythm}
        onStop={stop}
        onTempoChange={setTempo}
        playing={playing}
        rhythm={rhythm}
        source={position}
        tempo={tempo}
      />
    </div>
  );
}
