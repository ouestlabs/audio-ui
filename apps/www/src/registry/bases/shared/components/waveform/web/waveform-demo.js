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
    <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%; min-width: 0">
      <audio-ui-waveform default-value="30" duration="${DURATION_SECONDS}">
        <audio-ui-waveform-control aria-label="Track progress">
          <audio-ui-waveform-canvas></audio-ui-waveform-canvas>
          <audio-ui-waveform-region region="loop" value="[48,96]">
            <audio-ui-waveform-region-start region="loop"></audio-ui-waveform-region-start>
            <audio-ui-waveform-region-end region="loop"></audio-ui-waveform-region-end>
          </audio-ui-waveform-region>
          <audio-ui-waveform-marker value="20"><span data-slot="waveform-marker-label">Verse</span></audio-ui-waveform-marker>
          <audio-ui-waveform-marker value="124"><span data-slot="waveform-marker-label">Chorus</span></audio-ui-waveform-marker>
          <audio-ui-waveform-hover></audio-ui-waveform-hover>
          <audio-ui-waveform-playhead></audio-ui-waveform-playhead>
          <audio-ui-waveform-thumb></audio-ui-waveform-thumb>
        </audio-ui-waveform-control>
      </audio-ui-waveform>
      <p style="color: var(--muted-foreground); font-size: 0.875rem; font-variant-numeric: tabular-nums" data-loop>Loop 0:48 – 1:36</p>
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
