"use client";

import { useState } from "react";
import {
  Waveform,
  WaveformRegion,
  WaveformRegionHandle,
} from "@/registry-audio/bases/base/audio/elements/waveform";

const DURATION_SECONDS = 120;
const SLICES = 4096;

// Stand-in for the peaks of a decoded file: each slice's lowest and highest
// sample, lopsided the way real audio is.
const PEAKS = (() => {
  const max = new Float32Array(SLICES);
  const min = new Float32Array(SLICES);
  for (let index = 0; index < SLICES; index += 1) {
    const time = index / SLICES;
    const phrase = 0.35 + 0.65 * Math.abs(Math.sin(time * 9 + 0.6));
    const beat = 0.25 + 0.75 * Math.abs(Math.sin(index * 0.09)) ** 3;
    const grain = Math.abs((Math.sin(index * 12.9898) * 43_758.5453) % 1);
    const level = phrase * beat * (0.6 + 0.4 * grain);
    max[index] = Math.min(1, level * (0.75 + 0.25 * Math.sin(index * 0.013)));
    min[index] = -Math.min(1, level * (0.75 - 0.25 * Math.sin(index * 0.017)));
  }
  return { max, min };
})();

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const describePosition = (seconds: number) => formatTime(seconds);

export default function WaveformWindowDemo() {
  const [zoomed, setZoomed] = useState<readonly [number, number]>([30, 45]);
  const [position, setPosition] = useState(36);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <Waveform
        aria-label="Whole track"
        className="h-12"
        duration={DURATION_SECONDS}
        getAriaValueText={describePosition}
        onValueChange={setPosition}
        value={position}
        values={PEAKS}
        variant="playhead"
      >
        <WaveformRegion
          aria-label="Stretch to zoom in on"
          onValueChange={setZoomed}
          value={zoomed}
        >
          <WaveformRegionHandle
            aria-label="Start of the stretch"
            edge="start"
            getAriaValueText={describePosition}
          />
          <WaveformRegionHandle
            aria-label="End of the stretch"
            edge="end"
            getAriaValueText={describePosition}
          />
        </WaveformRegion>
      </Waveform>
      <Waveform
        aria-label="Zoomed view"
        className="h-28"
        duration={DURATION_SECONDS}
        getAriaValueText={describePosition}
        onValueChange={setPosition}
        range={zoomed}
        value={position}
        values={PEAKS}
        variant="playhead"
      />
      <p className="text-muted-foreground text-sm tabular-nums">
        {formatTime(zoomed[0])} – {formatTime(zoomed[1])}
      </p>
    </div>
  );
}
