"use client";

import { useId, useState } from "react";
import { Fader } from "@/components/pure/fader";
import { Knob } from "@/components/pure/knob";
import { XYPad } from "@/components/pure/xypad";

export default function Pure() {
  const volumeId = useId();
  const [volume, setVolume] = useState(72);
  const [pan, setPan] = useState(50);
  const [filter, setFilter] = useState({ x: 50, y: 50 });

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 p-8">
      <p className="text-neutral-500 text-xs">
        pure · @audio-ui/react · default headless visual
      </p>
      <div className="flex flex-wrap items-start justify-center gap-6">
        <section
          aria-label="Volume"
          className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 p-4"
        >
          <h2 className="font-medium text-xs">Volume</h2>
          <Fader
            aria-label="Volume"
            id={volumeId}
            max={100}
            min={0}
            onValueChange={setVolume}
            value={volume}
          />
          <output className="text-xs tabular-nums">{`${volume}%`}</output>
        </section>

        <section
          aria-label="Pan"
          className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 p-4"
        >
          <h2 className="font-medium text-xs">Pan</h2>
          <Knob
            aria-label="Pan"
            max={100}
            min={0}
            onValueChange={setPan}
            value={pan}
          />
          <output className="text-xs tabular-nums">{`${pan}%`}</output>
        </section>

        <section
          aria-label="Filter"
          className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 p-4"
        >
          <h2 className="font-medium text-xs">Filter</h2>
          <XYPad
            aria-label="Filter frequency and resonance"
            onValueChange={setFilter}
            value={filter}
          />
          <p className="text-xs">Freq / Reso</p>
        </section>
      </div>
    </div>
  );
}
