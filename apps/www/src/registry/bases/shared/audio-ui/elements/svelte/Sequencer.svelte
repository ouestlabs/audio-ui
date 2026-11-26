<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { Sequencer } from "@/registry/primitives/sequencer/svelte/index";

let {
  beatEvery = 4,
  cell,
  rowLabel,
  rowLabels,
  shadeByVelocity = false,
  showVelocity = false,
  size = "default",
  velocities,
  ...rest
}: Omit<ComponentProps<typeof Sequencer.Root>, "children" | "velocities"> & {
  /** Highlights every `beatEvery` steps, such as 4 for a beat in sixteenths. */
  beatEvery?: number;
  /** What a step shows inside it. */
  cell?: Snippet<[{ row: number; step: number }]>;
  /** What sits beside a row in place of its written name: the row keeps its name for assistive technology. */
  rowLabel?: Snippet<[{ row: number }]>;
  /** Names each row, such as "Kick": it labels the row for assistive technology and is written beside it. */
  rowLabels?: readonly string[];
  /** Draws a step that plays fainter the softer it plays, by `velocities`. */
  shadeByVelocity?: boolean;
  /** Draws a bar under each row to set how loud every step plays. */
  showVelocity?: boolean;
  /** `sm` draws short steps and a thin bar under them, so many rows fit. */
  size?: "default" | "sm";
  velocities?: readonly (readonly number[])[];
} = $props();

const indexes = (length: number) => Array.from({ length }, (_, index) => index);
const nameOf = (row: number) => rowLabels?.[row] ?? `Row ${row + 1}`;
const levelOf = (row: number, step: number) =>
  0.35 + 0.65 * (velocities?.[row]?.[step] ?? 1);
</script>

<Sequencer.Root
  {...rest}
  data-labels={rowLabels ? "" : undefined}
  data-shaded={shadeByVelocity ? "" : undefined}
  data-size={size}
  {velocities}
>
  {#snippet children(
    state
  )}
    {#each indexes(state.rows) as row (row)}
      <Sequencer.Row aria-label={nameOf(row)} index={row}>
        {#if rowLabel}
          {@render rowLabel({ row })}
        {:else if rowLabels}
          <span aria-hidden="true" data-slot="sequencer-row-label"
            >{rowLabels[row]}</span
          >
        {/if}
        <div data-slot="sequencer-steps">
          <div data-slot="sequencer-cells">
            {#each indexes(state.steps) as step (step)}
              <Sequencer.Cell
                aria-label={`${nameOf(row)}, step ${step + 1}`}
                data-beat={step % beatEvery === 0 ? "" : undefined}
                data-step={step}
                {row}
                {step}
                style={shadeByVelocity
                  ? `--sequencer-cell-level: ${levelOf(row, step)}`
                  : undefined}
              >
                {@render cell?.({ row, step })}
              </Sequencer.Cell>
            {/each}
          </div>
          {#if showVelocity}
            <div data-slot="sequencer-cells">
              {#each indexes(state.steps) as step (step)}
                <Sequencer.Velocity
                  aria-label={`${nameOf(row)}, step ${step + 1} velocity`}
                  {row}
                  {step}
                >
                  <span data-slot="sequencer-velocity-fill"></span>
                </Sequencer.Velocity>
              {/each}
            </div>
          {/if}
        </div>
      </Sequencer.Row>
    {/each}
  {/snippet}
</Sequencer.Root>
