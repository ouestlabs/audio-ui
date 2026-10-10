"use client";

import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import { secondsPerBar } from "@/registry-audio/bases/base/lib/musical-time";

const TIME_SIGNATURE = { beatsPerBar: 4, beatUnit: 4 };
const LOOP_BARS = 4;

/** The transport of a DAW, with a clock standing in for the engine: play, stop, return, loop four bars, and change the tempo. */
export default function TransportDemo() {
  const [position] = useState(() => createSource(0));
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [looping, setLooping] = useState(true);
  const [bpm, setBpm] = useState(120);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const loopEnd = LOOP_BARS * secondsPerBar({ ...TIME_SIGNATURE, bpm });
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
  }, [bpm, looping, playing, position]);

  const play = useCallback(() => setPlaying(true), []);
  const stop = useCallback(() => setPlaying(false), []);
  const returnToStart = useCallback(() => position.set(0), [position]);

  return (
    <div className="w-full max-w-2xl">
      <Transport
        bpm={bpm}
        looping={looping}
        onBpmChange={setBpm}
        onLoopingChange={setLooping}
        onPlay={play}
        onRecordingChange={setRecording}
        onReturn={returnToStart}
        onStop={stop}
        playing={playing}
        recording={recording}
        source={position}
        tempo={TIME_SIGNATURE}
      />
    </div>
  );
}
