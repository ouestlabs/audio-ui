<script lang="ts">
import type { ComponentProps } from "svelte";
import { Envelope } from "@/registry/primitives/envelope/svelte/index";

type Domain = readonly [number, number];
type Snap = number | { x: number; y: number };

let {
  class: className,
  curves = true,
  formatValue,
  size = "default",
  snap,
  xDomain,
  xUnit,
  yDomain,
  yUnit,
  ...rest
}: Omit<ComponentProps<typeof Envelope.Root>, "children" | "snap"> & {
  class?: string;
  /** Whether a handle on each segment bends it. */
  curves?: boolean;
  /** Prints a point's value in the label that shows while it is dragged or focused, and in its accessible value text. Defaults to the values in `xDomain` and `yDomain`, or percentages. */
  formatValue?: (point: { x: number; y: number }) => string;
  size?: "sm" | "default" | "lg";
  /** Grid points snap to, in normalized units, one step for both axes or one for each: the grid's lines are the snapping ones. */
  snap?: Snap;
  /** The values the horizontal axis runs from and to, for the labels: `[0, 2000]` with `xUnit="ms"`. Unset, it reads in percent. */
  xDomain?: Domain;
  xUnit?: string;
  /** The values the vertical axis runs from and to, for the labels. */
  yDomain?: Domain;
  yUnit?: string;
} = $props();

/** The frame's room for the end points, which the grid's lines are measured from. */
const INSET = "0.875rem";
const DEFAULT_GRID_STEP = 0.25;
/** Above this level a point's label sits under it, not over it. */
const LABEL_FLIP_ABOVE = 0.8;

const gridStep = (step: number | undefined) =>
  step && step > 0 ? step : DEFAULT_GRID_STEP;

/** A line every step of `snap` across and down, on the data's own coordinates. */
const gridLines = $derived.by(() => {
  const [x, y] = typeof snap === "object" ? [snap.x, snap.y] : [snap, snap];
  const share = (step: number | undefined) =>
    `calc((100% - 2 * ${INSET}) * ${gridStep(step)})`;
  return `background-image: linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px); background-position: ${INSET} 0, 0 ${INSET}; background-size: ${share(x)} 100%, 100% ${share(y)}`;
});

/** A share of the axis as a value in the axis's own units, to three significant digits. */
function describeAxis(share: number, domain?: Domain, unit = "") {
  const [min, max] = domain ?? [0, 100];
  const value = Number((min + share * (max - min)).toPrecision(3));
  const text = domain ? String(value) : `${Math.round(share * 100)}`;
  const suffix = domain ? unit : "%";
  return suffix === "%" ? `${text}%` : `${text} ${suffix}`.trim();
}

const describe = (point: { x: number; y: number }) =>
  formatValue
    ? formatValue(point)
    : `${describeAxis(point.x, xDomain, xUnit)} · ${describeAxis(point.y, yDomain, yUnit)}`;

/** A segment's bend as a signed percentage: positive holds the start of the segment, negative the end. */
const describeCurve = (curve = 0) =>
  `Curve ${curve > 0 ? "+" : ""}${Math.round(curve * 100)}%`;
</script>

<div
  class={className}
  data-size={size}
  data-slot="envelope-frame"
  style={gridLines}
>
  <Envelope.Root {...rest} role="group" {snap}>
    {#snippet children(
      state
    )}
      <Envelope.Graph>
        <Envelope.Fill />
        <Envelope.Line />
      </Envelope.Graph>
      {#if curves}
        {#each state.value.slice(0, -1) as segment, index (index)}
          <Envelope.Segment aria-label={`Curve ${index + 1}`} {index}>
            <span aria-hidden="true" data-slot="envelope-segment-value"
              >{describeCurve(segment.curve)}</span
            >
          </Envelope.Segment>
        {/each}
      {/if}
      {#each state.value as point, index (index)}
        <Envelope.Point
          aria-label={`Point ${index + 1} of ${state.value.length}`}
          getAriaValueText={describe}
          {index}
        >
          <span
            aria-hidden="true"
            data-below={point.y > LABEL_FLIP_ABOVE ? "" : undefined}
            data-slot="envelope-point-value"
            >{describe(point)}</span
          >
        </Envelope.Point>
      {/each}
    {/snippet}
  </Envelope.Root>
</div>
