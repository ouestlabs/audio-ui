<script lang="ts">
import { Envelope } from "@/registry-audio/bases/base/primitives/envelope/svelte/index";

let points = $state([
  { x: 0, y: 0 },
  { x: 0.15, y: 1 },
  { x: 0.6, y: 0.5 },
  { x: 1, y: 0 },
]);

const describe = (point: { x: number; y: number }) =>
  `${Math.round(point.x * 100)}% · ${Math.round(point.y * 100)}%`;
</script>

<div
  class="cn-envelope cn-envelope-size-default group/envelope box-border w-full cursor-crosshair touch-none select-none p-3.5 has-data-disabled:pointer-events-none has-data-disabled:opacity-50"
>
  <Envelope.Root
    aria-label="Envelope"
    class="size-full data-disabled:cursor-not-allowed"
    onValueChange={(next) => {
      points = next;
    }}
    role="group"
    value={points}
  >
    {#snippet children(
      state
    )}
      <Envelope.Graph class="size-full overflow-visible">
        <Envelope.Fill class="cn-envelope-fill" />
        <Envelope.Line class="cn-envelope-path [stroke-linejoin:round]" />
      </Envelope.Graph>
      {#each state.value.slice(0, -1) as _, index (index)}
        <Envelope.Segment
          aria-label={`Curve ${index + 1}`}
          class="cn-envelope-curve group/segment cursor-ns-resize opacity-0 outline-none after:absolute after:-inset-2 pointer-coarse:opacity-100 pointer-coarse:after:-inset-4 group-focus-within/envelope:opacity-100 group-hover/envelope:opacity-100 data-dragging:opacity-100"
          {index}
        />
      {/each}
      {#each state.value as point, index (index)}
        <Envelope.Point
          aria-label={`Point ${index + 1} of ${state.value.length}`}
          class="cn-envelope-point group/point size-4 cursor-grab data-dragging:bg-primary focus-visible:bg-primary touch-none select-none outline-none after:absolute after:-inset-2 pointer-coarse:after:-inset-3.5 active:cursor-grabbing"
          getAriaValueText={describe}
          {index}
        >
          <span
            aria-hidden="true"
            class="cn-envelope-point-value -translate-x-1/2 pointer-events-none absolute left-1/2 z-10 hidden whitespace-nowrap group-hover/point:block group-data-dragging/point:block group-focus-visible/point:block bottom-full mb-2"
            >{describe(point)}</span
          >
        </Envelope.Point>
      {/each}
    {/snippet}
  </Envelope.Root>
</div>
