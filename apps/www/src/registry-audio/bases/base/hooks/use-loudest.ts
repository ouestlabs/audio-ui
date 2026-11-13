import { useEffect, useState } from "react";

/** How many frames are read at a time, so a long recording does not hold the page. */
const CHUNK = 1 << 20;

/** The loudest sample of a recording, 0 to 1, read in chunks a frame apart. */
function loudestOf(
  samples: {
    frames: number;
    read: (
      from: number,
      to: number
    ) => ArrayLike<number> | Promise<ArrayLike<number>>;
  },
  gone: () => boolean
): Promise<number> {
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
  return from(0);
}

/**
 * The loudest sample of a recording, 0 to 1: what a waveform drawn on the GPU
 * is scaled by, so a quiet recording still fills its lane. `null` until it is
 * read, a chunk a frame, and for no samples.
 */
export function useLoudest(
  samples:
    | {
        frames: number;
        read: (
          from: number,
          to: number
        ) => ArrayLike<number> | Promise<ArrayLike<number>>;
      }
    | undefined
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
    loudestOf(samples, () => over).then(
      (value) => {
        if (!over) {
          setLoudest({ of: samples, value });
        }
      },
      () => undefined
    );
    return () => {
      over = true;
    };
  }, [samples]);
  return samples && loudest?.of === samples ? loudest.value : null;
}
