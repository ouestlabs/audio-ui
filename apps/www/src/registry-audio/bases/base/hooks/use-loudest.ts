import { leavesPeak } from "@audio-ui/gl/waveform";
import { useEffect, useState } from "react";

/** How many frames are read at a time, so a long recording does not hold the page. */
const CHUNK = 1 << 20;

/** A recording's samples: how many frames, a reader of them, and for a streamed one what it sums up to. */
interface Samples {
  frames: number;
  leaves?: () => ArrayLike<number> | Promise<ArrayLike<number>>;
  read: (
    from: number,
    to: number
  ) => ArrayLike<number> | Promise<ArrayLike<number>>;
}

/** The loudest sample of a recording, 0 to 1: from its leaves when it has them, else read in chunks a frame apart. */
async function loudestOf(samples: Samples, gone: () => boolean) {
  if (samples.leaves) {
    return leavesPeak(await samples.leaves());
  }
  let loudest = 0;
  const from = async (start: number): Promise<number> => {
    if (start >= samples.frames || gone()) {
      return loudest;
    }
    const read = await samples.read(
      start,
      Math.min(samples.frames, start + CHUNK)
    );
    for (const value of Array.from(read)) {
      const level = Math.abs(value);
      if (level > loudest) {
        loudest = level;
      }
    }
    // A frame between chunks: reading a long recording does not stop the page.
    await new Promise((resolve) => setTimeout(resolve));
    return await from(start + CHUNK);
  };
  return await from(0);
}

/**
 * The loudest sample of a recording, 0 to 1: what a waveform drawn on the GPU
 * is scaled by, so a quiet recording still fills its lane. Given its
 * `channels`, the loudest of them, which its mix never passes, so a row a
 * channel fits too. A streamed recording is read from its leaves; another a
 * chunk a frame. `null` until it is read, and for no samples.
 */
export function useLoudest(
  samples: Samples | undefined,
  channels?: readonly Samples[]
): number | null {
  const [loudest, setLoudest] = useState<{
    of: unknown;
    value: number;
  } | null>(null);
  useEffect(() => {
    if (!samples) {
      return;
    }
    let over = false;
    const readers = channels && channels.length > 0 ? channels : [samples];
    Promise.all(readers.map((reader) => loudestOf(reader, () => over))).then(
      (values) => {
        if (!over) {
          setLoudest({ of: samples, value: Math.max(0, ...values) });
        }
      },
      () => undefined
    );
    return () => {
      over = true;
    };
  }, [channels, samples]);
  return samples && loudest?.of === samples ? loudest.value : null;
}
