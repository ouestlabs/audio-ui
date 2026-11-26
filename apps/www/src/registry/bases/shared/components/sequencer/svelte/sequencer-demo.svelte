<script lang="ts">
import { onDestroy } from "svelte";
import Sequencer from "@/registry/bases/shared/audio-ui/elements/svelte/Sequencer.svelte";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry/lib/drums/drum-synthesis";
import { createStepPlayer } from "@/registry/lib/drums/step-player";
import { webAudio } from "@/registry/lib/web-audio";

const STEPS = 16;
const BPM = 112;
const VOLUME = 0.7;
const ROWS = ["Kick", "Snare", "Hihat"];
const TRIGGERS = [triggerKick, triggerSnare, triggerHihat];
const VELOCITIES = [
  [1, 0.5, 0.7, 0.5, 0.9, 0.5, 0.7, 0.5, 1, 0.5, 0.7, 0.5, 0.9, 0.5, 0.7, 0.6],
  [1, 1, 1, 1, 0.8, 1, 1, 1, 1, 1, 1, 1, 0.85, 1, 1, 0.4],
  [
    0.55, 0.6, 0.9, 0.6, 0.55, 0.6, 0.9, 0.6, 0.55, 0.6, 0.9, 0.6, 0.55, 0.6,
    0.9, 0.6,
  ],
];
const on = (steps: number[]) =>
  Array.from({ length: STEPS }, (_, step) => steps.includes(step));
const BEAT = [on([0, 4, 8, 12]), on([4, 12]), on([2, 6, 10, 14])];
const EMPTY = () => ROWS.map(() => Array.from({ length: STEPS }, () => false));

/** Plays what the pattern holds on a step: each hit goes through a gain of its own, the step's velocity. */
function playStep(rows: boolean[][], levels: number[][], step: number) {
  const ctx = webAudio.resume();
  if (!ctx) {
    return;
  }
  rows.forEach((row, at) => {
    if (!row[step]) {
      return;
    }
    const hit = ctx.createGain();
    hit.gain.value = (levels[at]?.[step] ?? 1) * VOLUME;
    hit.connect(ctx.destination);
    TRIGGERS[at]?.(ctx, hit, ctx.currentTime);
  });
}

let pattern = $state(BEAT);
let velocities = $state(VELOCITIES);
let playing = $state(false);
const player = createStepPlayer({
  bpm: BPM,
  onStep: (step) => playStep(pattern, velocities, step),
  steps: STEPS,
});

function toggle() {
  if (player.isPlaying()) {
    player.stop();
  } else {
    player.start();
  }
  playing = player.isPlaying();
}

function clear() {
  pattern = EMPTY();
}

onDestroy(() => player.stop());
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%">
  <Sequencer
    aria-label="Drum pattern"
    onValueChange={(next) => {
      pattern = next;
    }}
    onVelocityChange={(next) => {
      velocities = next;
    }}
    rowLabels={ROWS}
    showVelocity
    source={player.source}
    value={pattern}
    {velocities}
  />
  <div
    style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem"
  >
    <button
      onclick={toggle}
      style="height: 2rem; padding: 0 0.75rem; border: 1px solid var(--border); border-radius: var(--radius, 0.5rem); background: var(--background); color: var(--foreground); font: inherit; font-size: 0.875rem; cursor: pointer"
      type="button"
    >
      {playing ? "Stop" : "Play"}
    </button>
    <button
      data-agent-confirm="Clears every step of the pattern"
      onclick={clear}
      style="height: 2rem; padding: 0 0.75rem; border: 0; border-radius: var(--radius, 0.5rem); background: transparent; color: var(--foreground); font: inherit; font-size: 0.875rem; cursor: pointer"
      type="button"
    >
      Clear
    </button>
  </div>
</div>
