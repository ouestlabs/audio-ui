import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry/lib/drums/drum-synthesis";
import { createStepPlayer } from "@/registry/lib/drums/step-player";
import { webAudio } from "@/registry/lib/web-audio";
import "@/registry/primitives/sequencer/web";

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
const on = (steps) =>
  Array.from({ length: STEPS }, (_, step) => steps.includes(step));
const BEAT = [on([0, 4, 8, 12]), on([4, 12]), on([2, 6, 10, 14])];
const EMPTY = () => ROWS.map(() => Array.from({ length: STEPS }, () => false));

/** Plays what the pattern holds on a step: each hit goes through a gain of its own, the step's velocity. */
function playStep(rows, levels, step) {
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

/** Draws the sequencer into `element`, and returns what takes it away. The rows, the steps and the velocity bars are made for you: styled here from their tags. */
export default function sequencerWebDemo(element) {
  let pattern = BEAT;
  let velocities = VELOCITIES;
  const player = createStepPlayer({
    bpm: BPM,
    onStep: (step) => playStep(pattern, velocities, step),
    steps: STEPS,
  });

  element.innerHTML = `
    <style>
      /* The rows the custom element makes hold their cells and velocity bars side by side: a grid of the pattern's steps lays them out. The sheet draws each cell and bar. */
      audio-ui-sequencer[data-slot] [data-slot=sequencer-row] { display: grid; grid-template-columns: repeat(16, minmax(0, 1fr)); gap: 0.25rem; }
      audio-ui-sequencer[data-slot] [data-slot=sequencer-cell] { height: 2.25rem; }
      audio-ui-sequencer[data-slot] audio-ui-sequencer-velocity { position: relative; height: 2rem; cursor: ns-resize; background: linear-gradient(to top, var(--muted-foreground) calc(var(--sequencer-velocity) * 100%), transparent 0); }
    </style>
    <div style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%">
      <audio-ui-sequencer aria-label="Drum pattern" velocity-bars velocities='${JSON.stringify(velocities)}' value='${JSON.stringify(pattern)}'></audio-ui-sequencer>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem">
        <button data-action="toggle" style="height: 2rem; padding: 0 0.75rem; border: 1px solid var(--border); border-radius: var(--radius, 0.5rem); background: var(--background); color: var(--foreground); font: inherit; font-size: 0.875rem; cursor: pointer" type="button">Play</button>
        <button data-action="clear" style="height: 2rem; padding: 0 0.75rem; border: 0; border-radius: var(--radius, 0.5rem); background: transparent; color: var(--foreground); font: inherit; font-size: 0.875rem; cursor: pointer" type="button">Clear</button>
      </div>
    </div>`;
  const grid = element.querySelector("audio-ui-sequencer");
  if (grid) {
    grid.source = player.source;
  }
  const onInput = (event) => {
    pattern = event.detail.value;
  };
  const onClick = (event) => {
    const action = event.target
      .closest("[data-action]")
      ?.getAttribute("data-action");
    if (action === "toggle") {
      if (player.isPlaying()) {
        player.stop();
      } else {
        player.start();
      }
      const button = element.querySelector('[data-action="toggle"]');
      if (button) {
        button.textContent = player.isPlaying() ? "Stop" : "Play";
      }
    } else if (action === "clear") {
      pattern = EMPTY();
      if (grid) {
        grid.setAttribute("value", JSON.stringify(pattern));
      }
    }
  };
  const onVelocity = (event) => {
    velocities = event.detail.value;
  };
  grid?.addEventListener("input", onInput);
  grid?.addEventListener("velocitychange", onVelocity);
  element.addEventListener("click", onClick);
  return () => {
    player.stop();
    grid?.removeEventListener("input", onInput);
    grid?.removeEventListener("velocitychange", onVelocity);
    element.removeEventListener("click", onClick);
    element.innerHTML = "";
  };
}
