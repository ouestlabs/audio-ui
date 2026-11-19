<script lang="ts">
import { onDestroy } from "svelte";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry/bases/shared/lib/drum-synthesis";
import { createStepPlayer } from "@/registry/bases/shared/lib/step-player";
import { webAudio } from "@/registry/bases/shared/lib/web-audio";
import { Sequencer } from "@/registry/primitives/sequencer/svelte/index";

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

<div class="flex w-full flex-col gap-3">
  <Sequencer.Root
    aria-label="Drum pattern"
    class="cn-sequencer w-full min-w-0 select-none data-disabled:opacity-50 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1.5"
    onValueChange={(next) => {
      pattern = next;
    }}
    onVelocityChange={(next) => {
      velocities = next;
    }}
    source={player.source}
    value={pattern}
    {velocities}
  >
    {#snippet children(
      state
    )}
      {#each Array.from({ length: state.rows }, (_, row) => row) as row (row)}
        <Sequencer.Row
          aria-label={ROWS[row]}
          class="col-span-2 grid grid-cols-subgrid items-center"
          index={row}
        >
          <span
            aria-hidden="true"
            class="max-w-24 truncate text-muted-foreground text-xs"
            >{ROWS[row]}</span
          >
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="grid auto-cols-fr grid-flow-col gap-1">
              {#each Array.from(
                { length: state.steps },
                (_, step) => step
              ) as step (step)}
                <Sequencer.Cell
                  aria-label={`${ROWS[row]}, step ${step + 1}`}
                  class="cn-sequencer-cell flex h-9 min-w-0 cursor-pointer touch-none items-center justify-center font-medium text-[9px] tabular-nums outline-none aria-pressed:text-primary-foreground {step %
                    4 ===
                  0
                    ? "cn-sequencer-cell-beat"
                    : ""}"
                  {row}
                  {step}
                />
              {/each}
            </div>
            <div class="grid auto-cols-fr grid-flow-col gap-1">
              {#each Array.from(
                { length: state.steps },
                (_, step) => step
              ) as step (step)}
                <Sequencer.Velocity
                  aria-label={`${ROWS[row]}, step ${step + 1} velocity`}
                  class="cn-sequencer-velocity group/velocity relative h-8 min-w-0 cursor-ns-resize touch-none outline-none"
                  {row}
                  {step}
                >
                  <span
                    class="cn-sequencer-velocity-fill absolute inset-x-0 bottom-0 h-[calc(var(--sequencer-velocity)*100%)]"
                  ></span>
                </Sequencer.Velocity>
              {/each}
            </div>
          </div>
        </Sequencer.Row>
      {/each}
    {/snippet}
  </Sequencer.Root>
  <div class="flex items-center justify-between gap-2">
    <button
      class="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm hover:bg-muted"
      onclick={toggle}
      type="button"
    >
      {playing ? "Stop" : "Play"}
    </button>
    <button
      class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted"
      data-agent-confirm="Clears every step of the pattern"
      onclick={clear}
      type="button"
    >
      Clear
    </button>
  </div>
</div>
