<script lang="ts">
import { Waveform } from "@/registry/bases/shared/primitives/waveform/svelte/index";

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

<div class="flex w-full min-w-0 flex-col gap-2">
  <Waveform.Root
    class="group/waveform w-full min-w-0 data-disabled:cursor-not-allowed"
    defaultValue={30}
    duration={DURATION_SECONDS}
    peaks={PEAKS}
  >
    <Waveform.Control
      aria-label="Track progress"
      class="cn-waveform relative w-full min-w-0 cursor-pointer touch-none select-none overflow-hidden py-1 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 data-disabled:pointer-events-none data-disabled:opacity-50 data-loading:cursor-progress"
      getAriaValueText={describePosition}
    >
      <Waveform.Canvas
        class="cn-waveform-canvas block size-full [-webkit-mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] mask-[linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]"
      />
      <Waveform.Region
        class="cn-waveform-region pointer-events-none inset-y-0"
        onValueChange={(next) => {
          loop = next;
        }}
        region="loop"
        value={loop}
      >
        <Waveform.RegionHandle
          aria-label="Loop start"
          class="cn-waveform-region-handle pointer-events-auto absolute inset-y-0 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0 after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3"
          edge="start"
          getAriaValueText={formatTime}
          region="loop"
        />
        <Waveform.RegionHandle
          aria-label="Loop end"
          class="cn-waveform-region-handle pointer-events-auto absolute inset-y-0 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0 after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3"
          edge="end"
          getAriaValueText={formatTime}
          region="loop"
        />
      </Waveform.Region>
      <Waveform.Marker
        class="cn-waveform-marker pointer-events-none inset-y-0 w-px"
        value={20}
      >
        <span
          class="cn-waveform-marker-label absolute top-0 left-1 whitespace-nowrap"
          >Verse</span
        >
      </Waveform.Marker>
      <Waveform.Marker
        class="cn-waveform-marker pointer-events-none inset-y-0 w-px"
        value={124}
      >
        <span
          class="cn-waveform-marker-label absolute top-0 left-1 whitespace-nowrap"
          >Chorus</span
        >
      </Waveform.Marker>
      <Waveform.Hover
        class="cn-waveform-hover pointer-events-none inset-y-0 z-10 w-px indent-1 whitespace-nowrap"
        format={formatTime}
      />
      <Waveform.Playhead
        class="cn-waveform-playhead group-data-outside/waveform:hidden"
      />
      <Waveform.Thumb
        class="cn-waveform-thumb group-data-outside/waveform:hidden"
      />
    </Waveform.Control>
  </Waveform.Root>
  <p class="text-muted-foreground text-sm tabular-nums">
    Loop {formatTime(loop[0])} – {formatTime(loop[1])}
  </p>
</div>
