"use client";

import { useState } from "react";
import {
  Waveform,
  WaveformHover,
  WaveformMarker,
  WaveformRegion,
  WaveformRegionHandle,
} from "@/registry-audio/bases/base/audio/elements/waveform";

const DURATION_SECONDS = 180;

// Stand-in for the peaks of a decoded audio file.
const VALUES = Array.from({ length: 512 }, (_, index) => {
  const time = index / 512;
  const section =
    0.5 + 0.28 * Math.sin(time * 11 + 0.8) + 0.18 * Math.sin(time * 29);
  const beat = 0.7 + 0.3 * Math.abs(Math.cos(index * 0.26));
  const grain = Math.abs((Math.sin(index * 12.9898) * 43_758.5453) % 1);
  const level = section * beat * (0.45 + 0.55 * grain) + 0.04;
  return Math.round(Math.min(1, level) * 1000) / 1000;
});

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const describePosition = (value: number, duration: number) =>
  `${formatTime(value)} of ${formatTime(duration)}`;

export default function WaveformRegionDemo() {
  const [loop, setLoop] = useState<readonly [number, number]>([48, 96]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <Waveform
        aria-label="Track progress"
        defaultValue={30}
        duration={DURATION_SECONDS}
        getAriaValueText={describePosition}
        values={VALUES}
        variant="playhead"
      >
        <WaveformRegion onValueChange={setLoop} value={loop}>
          <WaveformRegionHandle
            aria-label="Loop start"
            edge="start"
            getAriaValueText={formatTime}
          />
          <WaveformRegionHandle
            aria-label="Loop end"
            edge="end"
            getAriaValueText={formatTime}
          />
        </WaveformRegion>
        <WaveformMarker value={20}>Verse</WaveformMarker>
        <WaveformMarker value={124}>Chorus</WaveformMarker>
        <WaveformHover format={formatTime} />
      </Waveform>
      <p className="text-muted-foreground text-sm tabular-nums">
        Loop {formatTime(loop[0])} – {formatTime(loop[1])}
      </p>
    </div>
  );
}
