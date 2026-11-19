import "@/registry/primitives/waveform/web";

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

function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Draws the waveform into `element`, and returns what takes it away. The canvas and the inputs are made for you. */
export default function waveformWebDemo(element) {
  element.innerHTML = `
    <div class="flex w-full min-w-0 flex-col gap-2">
      <audio-ui-waveform class="group/waveform w-full min-w-0 data-disabled:cursor-not-allowed" default-value="30" duration="${DURATION_SECONDS}">
        <audio-ui-waveform-control aria-label="Track progress" class="cn-waveform relative w-full min-w-0 cursor-pointer touch-none select-none overflow-hidden py-1 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 data-disabled:pointer-events-none data-disabled:opacity-50 data-loading:cursor-progress">
          <audio-ui-waveform-canvas class="cn-waveform-canvas block size-full [-webkit-mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] mask-[linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]"></audio-ui-waveform-canvas>
          <audio-ui-waveform-region class="cn-waveform-region pointer-events-none inset-y-0" region="loop" value="[48,96]">
            <audio-ui-waveform-region-start class="cn-waveform-region-handle pointer-events-auto absolute inset-y-0 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0 after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3" region="loop"></audio-ui-waveform-region-start>
            <audio-ui-waveform-region-end class="cn-waveform-region-handle pointer-events-auto absolute inset-y-0 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0 after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3" region="loop"></audio-ui-waveform-region-end>
          </audio-ui-waveform-region>
          <audio-ui-waveform-marker class="cn-waveform-marker pointer-events-none inset-y-0 w-px" value="20"><span class="cn-waveform-marker-label absolute top-0 left-1 whitespace-nowrap">Verse</span></audio-ui-waveform-marker>
          <audio-ui-waveform-marker class="cn-waveform-marker pointer-events-none inset-y-0 w-px" value="124"><span class="cn-waveform-marker-label absolute top-0 left-1 whitespace-nowrap">Chorus</span></audio-ui-waveform-marker>
          <audio-ui-waveform-hover class="cn-waveform-hover pointer-events-none inset-y-0 z-10 w-px indent-1 whitespace-nowrap"></audio-ui-waveform-hover>
          <audio-ui-waveform-playhead class="cn-waveform-playhead group-data-outside/waveform:hidden"></audio-ui-waveform-playhead>
          <audio-ui-waveform-thumb class="cn-waveform-thumb group-data-outside/waveform:hidden"></audio-ui-waveform-thumb>
        </audio-ui-waveform-control>
      </audio-ui-waveform>
      <p class="text-muted-foreground text-sm tabular-nums" data-loop>Loop 0:48 – 1:36</p>
    </div>`;
  const waveform = element.querySelector("audio-ui-waveform");
  const hover = element.querySelector("audio-ui-waveform-hover");
  const label = element.querySelector("[data-loop]");
  if (waveform) {
    waveform.peaks = PEAKS;
  }
  if (hover) {
    hover.format = formatTime;
  }
  const onRegion = (event) => {
    const [start, end] = event.detail.value;
    if (label) {
      label.textContent = `Loop ${formatTime(start)} – ${formatTime(end)}`;
    }
  };
  waveform?.addEventListener("regionchange", onRegion);
  return () => {
    waveform?.removeEventListener("regionchange", onRegion);
    element.innerHTML = "";
  };
}
