import { createSource } from "@audio-ui/react";
import { useLayoutEffect, useState } from "react";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import {
  DEFAULT_TEMPO,
  secondsPerBar,
} from "@/registry-audio/bases/base/lib/musical-time";

const LOOP_BARS = 4;
const START = 0.3;
const ignore = () => undefined;

/** A DAW's transport, playing a four-bar loop at 120 BPM with the metronome on. */
export function TransportShowcase({ t }: { t: number }) {
  const [position] = useState(() => createSource(0));
  const playing = t > START;
  const seconds =
    Math.max(t - START, 0) % (LOOP_BARS * secondsPerBar(DEFAULT_TEMPO));
  useLayoutEffect(() => position.set(seconds), [position, seconds]);
  return (
    <div className="flex h-full items-center">
      {/* The loop, metronome and tempo controls only show with their handlers. */}
      <Transport
        looping
        metronome
        onLoopingChange={ignore}
        onMetronomeChange={ignore}
        onPlayPause={ignore}
        onRhythmChange={ignore}
        onStop={ignore}
        onTempoChange={ignore}
        playing={playing}
        source={position}
        tempo={DEFAULT_TEMPO}
      />
    </div>
  );
}
