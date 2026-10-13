import { createSource } from "@audio-ui/react";
import { useLayoutEffect, useState } from "react";
import { Scrubber } from "@/registry-audio/bases/base/audio/elements/scrubber";
import { MOTION, tw } from "../motion.ts";

const DURATION = 215;
const SEEK_TO = 42;
/** Faster than real time, so the bar is seen moving. */
const SPEED = 6;
const ignore = () => undefined;

/** A track sought into, then playing: the bar and the clock follow. */
export function ScrubberShowcase({ t }: { t: number }) {
  const [position] = useState(() => createSource(0));
  const seconds =
    tw(t, 0.1, 0.7, 0, SEEK_TO, MOTION.enter) + Math.max(t - 0.7, 0) * SPEED;
  // The bar and the clock follow the source, outside React.
  useLayoutEffect(() => position.set(seconds % DURATION), [position, seconds]);
  return (
    <div className="flex h-full items-center">
      <Scrubber
        duration={DURATION}
        onPlayingChange={ignore}
        playing={t > 0.7}
        source={position}
      />
    </div>
  );
}
