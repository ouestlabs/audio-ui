"use client";

import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLoudnessMeter,
  type LiveLoudness,
  type LoudnessMeter,
} from "@audio-ui/engine/analysis";

const UNMEASURED: LiveLoudness = {
  integrated: Number.NEGATIVE_INFINITY,
  momentary: Number.NEGATIVE_INFINITY,
  shortTerm: Number.NEGATIVE_INFINITY,
};

const same = (a: LiveLoudness, b: LiveLoudness) =>
  a.integrated === b.integrated &&
  a.momentary === b.momentary &&
  a.shortTerm === b.shortTerm;

/**
 * How loud a signal is while it plays, as streaming services and
 * broadcasters measure it (ITU-R BS.1770): its momentary (400 ms),
 * short-term (3 s) and integrated loudness in LUFS. Pass the node whose
 * sound to measure, stereo, `null` while there is none: it is only listened
 * to, on the audio thread. A stable source, refreshed every 100 ms with no
 * React render, and nothing published while the reading holds still;
 * `clear` starts the integrated loudness over.
 */
export function useLoudness(signal: AudioNode | null) {
  const [source] = useState(() => createSource<LiveLoudness>(UNMEASURED));
  const meterRef = useRef<LoudnessMeter | null>(null);

  useEffect(() => {
    if (!signal) {
      return;
    }
    let meter: LoudnessMeter | null = null;
    let live = true;
    createLoudnessMeter(signal.context, (loudness) => {
      if (!same(loudness, source.getSnapshot())) {
        source.set(loudness);
      }
    }).then((made) => {
      if (!(live && made)) {
        made?.dispose();
        return;
      }
      meter = made;
      meterRef.current = made;
      signal.connect(made.input);
    });
    return () => {
      live = false;
      if (meter) {
        signal.disconnect(meter.input);
        meter.dispose();
      }
      meterRef.current = null;
      source.set(UNMEASURED);
    };
  }, [signal, source]);

  const clear = useCallback(() => {
    meterRef.current?.clear();
    source.set({
      ...source.getSnapshot(),
      integrated: Number.NEGATIVE_INFINITY,
    });
  }, [source]);

  return { clear, source };
}