"use client";

import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Scrubber } from "@/registry-audio/bases/base/audio/elements/scrubber";

const DURATION = 215;

/** A clock standing in for a player: it plays, you seek, and the bar and the time follow it. */
export default function ScrubberDemo() {
  const [position] = useState(() => createSource(42));
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = position.getSnapshot() + (now - last) / 1000;
      last = now;
      if (next >= DURATION) {
        position.set(0);
        setPlaying(false);
        return;
      }
      position.set(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, position]);

  const seek = useCallback(
    (seconds: number) => position.set(seconds),
    [position]
  );

  return (
    <div className="w-full">
      <Scrubber
        duration={DURATION}
        onPlayingChange={setPlaying}
        onSeek={seek}
        playing={playing}
        source={position}
      />
    </div>
  );
}
