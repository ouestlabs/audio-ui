<script lang="ts" setup>
import { onBeforeUnmount, ref } from "vue";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry-audio/bases/base/lib/drum-synthesis";
import { createStepPlayer } from "@/registry-audio/bases/base/lib/step-player";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";
import { Sequencer } from "@/registry-audio/bases/base/primitives/sequencer/vue";

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

const pattern = ref(BEAT);
const velocities = ref(VELOCITIES);
const playing = ref(false);
const player = createStepPlayer({
  bpm: BPM,
  onStep: (step) => playStep(pattern.value, velocities.value, step),
  steps: STEPS,
});

function toggle() {
  if (player.isPlaying()) {
    player.stop();
  } else {
    player.start();
  }
  playing.value = player.isPlaying();
}

onBeforeUnmount(() => player.stop());
</script>

<template>
  <div class="flex w-full flex-col gap-3">
    <Sequencer.Root
      aria-label="Drum pattern"
      class="cn-sequencer w-full min-w-0 select-none data-disabled:opacity-50 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1.5"
      :source="player.source"
      :value="pattern"
      :velocities="velocities"
      @value-change="(next) => { pattern = next; }"
      @velocity-change="(next) => { velocities = next; }"
    >
      <template #default="{ state }">
        <Sequencer.Row
          class="col-span-2 grid grid-cols-subgrid items-center"
          v-for="row in state.rows"
          :key="row"
          :aria-label="ROWS[row - 1]"
          :index="row - 1"
        >
          <span
            aria-hidden="true"
            class="max-w-24 truncate text-muted-foreground text-xs"
            >{{
              ROWS[row - 1]
            }}</span
          >
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="grid auto-cols-fr grid-flow-col gap-1">
              <Sequencer.Cell
                class="cn-sequencer-cell flex h-9 min-w-0 cursor-pointer touch-none items-center justify-center font-medium text-[9px] tabular-nums outline-none aria-pressed:text-primary-foreground"
                v-for="step in state.steps"
                :key="step"
                :aria-label="`${ROWS[row - 1]}, step ${step}`"
                :class="(step - 1) % 4 === 0 && 'cn-sequencer-cell-beat'"
                :row="row - 1"
                :step="step - 1"
              />
            </div>
            <div class="grid auto-cols-fr grid-flow-col gap-1">
              <Sequencer.Velocity
                class="cn-sequencer-velocity group/velocity relative h-8 min-w-0 cursor-ns-resize touch-none outline-none"
                v-for="step in state.steps"
                :key="step"
                :aria-label="`${ROWS[row - 1]}, step ${step} velocity`"
                :row="row - 1"
                :step="step - 1"
              >
                <span
                  class="cn-sequencer-velocity-fill absolute inset-x-0 bottom-0 h-[calc(var(--sequencer-velocity)*100%)]"
                />
              </Sequencer.Velocity>
            </div>
          </div>
        </Sequencer.Row>
      </template>
    </Sequencer.Root>
    <div class="flex items-center justify-between gap-2">
      <button
        class="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm hover:bg-muted"
        type="button"
        @click="toggle"
      >
        {{ playing ? "Stop" : "Play" }}
      </button>
      <button
        class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted"
        type="button"
        @click="pattern = EMPTY()"
      >
        Clear
      </button>
    </div>
  </div>
</template>
