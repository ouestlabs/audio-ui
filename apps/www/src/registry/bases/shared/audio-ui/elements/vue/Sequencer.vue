<script lang="ts" setup>
import { Sequencer } from "@/registry/primitives/sequencer/vue";

const props = withDefaults(
  defineProps<{
    /** Highlights every `beatEvery` steps, such as 4 for a beat in sixteenths. */
    beatEvery?: number;
    /** Names each row, such as "Kick": it labels the row for assistive technology and is written beside it. */
    rowLabels?: readonly string[];
    /** Draws a step that plays fainter the softer it plays, by `velocities`. */
    shadeByVelocity?: boolean;
    /** Draws a bar under each row to set how loud every step plays. */
    showVelocity?: boolean;
    /** `sm` draws short steps and a thin bar under them, so many rows fit. */
    size?: "default" | "sm";
    velocities?: readonly (readonly number[])[];
  }>(),
  { beatEvery: 4, shadeByVelocity: false, showVelocity: false, size: "default" }
);

defineSlots<{
  /** What sits beside a row in place of its written name: the row keeps its name for assistive technology. */
  "row-label"?: (scope: { row: number }) => unknown;
  /** What a step shows inside it. */
  cell?: (scope: { row: number; step: number }) => unknown;
}>();

const indexes = (length: number) => Array.from({ length }, (_, index) => index);
const nameOf = (row: number) => props.rowLabels?.[row] ?? `Row ${row + 1}`;
const levelOf = (row: number, step: number) =>
  0.35 + 0.65 * (props.velocities?.[row]?.[step] ?? 1);
</script>

<template>
  <Sequencer.Root
    :data-labels="rowLabels ? '' : undefined"
    :data-shaded="shadeByVelocity ? '' : undefined"
    :data-size="size"
    :velocities="velocities"
  >
    <template #default="{ state }">
      <Sequencer.Row
        v-for="row in indexes(state.rows)"
        :key="row"
        :aria-label="nameOf(row)"
        :index="row"
      >
        <slot name="row-label" :row="row">
          <span
            aria-hidden="true"
            data-slot="sequencer-row-label"
            v-if="rowLabels"
            >{{
              rowLabels[row]
            }}</span
          >
        </slot>
        <div data-slot="sequencer-steps">
          <div data-slot="sequencer-cells">
            <Sequencer.Cell
              v-for="step in indexes(state.steps)"
              :key="step"
              :aria-label="`${nameOf(row)}, step ${step + 1}`"
              :data-beat="step % beatEvery === 0 ? '' : undefined"
              :data-step="step"
              :row="row"
              :step="step"
              :style="
                shadeByVelocity
                  ? { '--sequencer-cell-level': levelOf(row, step) }
                  : undefined
              "
            >
              <slot name="cell" :row="row" :step="step" />
            </Sequencer.Cell>
          </div>
          <div data-slot="sequencer-cells" v-if="showVelocity">
            <Sequencer.Velocity
              v-for="step in indexes(state.steps)"
              :key="step"
              :aria-label="`${nameOf(row)}, step ${step + 1} velocity`"
              :row="row"
              :step="step"
            >
              <span data-slot="sequencer-velocity-fill" />
            </Sequencer.Velocity>
          </div>
        </div>
      </Sequencer.Row>
    </template>
  </Sequencer.Root>
</template>
