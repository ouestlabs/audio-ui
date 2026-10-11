"use client";

import { createSource } from "@audio-ui/react";
import { useEffect, useRef, useState } from "react";

/** A transport clock as a source: the playhead follows it without re-rendering React. */
export function usePlaybackClock(limits: {
  duration: number;
  loop: readonly [number, number];
  looping: boolean;
}) {
  const [clock] = useState(() => createSource(0));
  const [playing, setPlaying] = useState(false);
  // Read each frame, so a tempo or a loop edit does not restart the clock.
  const limitsRef = useRef(limits);
  limitsRef.current = limits;

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const { duration, loop, looping } = limitsRef.current;
      const before = clock.getSnapshot();
      let next = before + (now - last) / 1000;
      if (looping && before < loop[1] && next >= loop[1]) {
        next = loop[0] + (next - loop[1]);
      }
      clock.set(next % duration);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock, playing]);

  return { clock, playing, setPlaying };
}
