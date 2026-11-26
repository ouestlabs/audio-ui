<script lang="ts">
import { Waveform } from "@/registry/primitives/waveform/svelte/index";

const DURATION_SECONDS = 180;

// Stand-in for the peaks of a decoded audio file.
const PEAKS = Array.from({ length: 512 }, (_, index) => {
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

let loop = $state<readonly [number, number]>([48, 96]);
</script>

<div
  style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%; min-width: 0"
>
  <Waveform.Root defaultValue={30} duration={DURATION_SECONDS} peaks={PEAKS}>
    <Waveform.Control
      aria-label="Track progress"
      getAriaValueText={describePosition}
    >
      <Waveform.Canvas />
      <Waveform.Region
        onValueChange={(next) => {
          loop = next;
        }}
        region="loop"
        value={loop}
      >
        <Waveform.RegionHandle
          aria-label="Loop start"
          edge="start"
          getAriaValueText={formatTime}
          region="loop"
        />
        <Waveform.RegionHandle
          aria-label="Loop end"
          edge="end"
          getAriaValueText={formatTime}
          region="loop"
        />
      </Waveform.Region>
      <Waveform.Marker value={20}>
        <span data-slot="waveform-marker-label">Verse</span>
      </Waveform.Marker>
      <Waveform.Marker value={124}>
        <span data-slot="waveform-marker-label">Chorus</span>
      </Waveform.Marker>
      <Waveform.Hover format={formatTime} />
      <Waveform.Playhead />
      <Waveform.Thumb />
    </Waveform.Control>
  </Waveform.Root>
  <p
    style="color: var(--muted-foreground); font-size: 0.875rem; font-variant-numeric: tabular-nums"
  >
    Loop {formatTime(loop[0])} – {formatTime(loop[1])}
  </p>
</div>
