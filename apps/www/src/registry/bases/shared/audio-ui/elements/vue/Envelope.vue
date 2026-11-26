<script lang="ts" setup>
import { computed } from "vue";
import { Envelope } from "@/registry/primitives/envelope/vue";

type Domain = readonly [number, number];
type Snap = number | { x: number; y: number };

const props = withDefaults(
  defineProps<{
    /** Whether a handle on each segment bends it. */
    curves?: boolean;
    /** Prints a point's value in the label that shows while it is dragged or focused, and in its accessible value text. Defaults to the values in `xDomain` and `yDomain`, or percentages. */
    formatValue?: (point: { x: number; y: number }) => string;
    size?: "sm" | "default" | "lg";
    /** Grid points snap to, in normalized units, one step for both axes or one for each: the grid's lines are the snapping ones. */
    snap?: Snap;
    /** The values the horizontal axis runs from and to, for the labels: `[0, 2000]` with `x-unit="ms"`. Unset, it reads in percent. */
    xDomain?: Domain;
    xUnit?: string;
    /** The values the vertical axis runs from and to, for the labels. */
    yDomain?: Domain;
    yUnit?: string;
  }>(),
  { curves: true, size: "default" }
);

defineOptions({ inheritAttrs: false });

// The envelope's class goes to its frame, its options to its root.
const forRoot = ({ class: _class, ...rest }: Record<string, unknown>) => rest;

/** The frame's room for the end points, which the grid's lines are measured from. */
const INSET = "0.875rem";
const DEFAULT_GRID_STEP = 0.25;
/** Above this level a point's label sits under it, not over it. */
const LABEL_FLIP_ABOVE = 0.8;

const gridStep = (step: number | undefined) =>
  step && step > 0 ? step : DEFAULT_GRID_STEP;

/** A line every step of `snap` across and down, on the data's own coordinates. */
const gridLines = computed(() => {
  const { snap } = props;
  const [x, y] = typeof snap === "object" ? [snap.x, snap.y] : [snap, snap];
  const share = (step: number | undefined) =>
    `calc((100% - 2 * ${INSET}) * ${gridStep(step)})`;
  return {
    backgroundImage:
      "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
    backgroundPosition: `${INSET} 0, 0 ${INSET}`,
    backgroundSize: `${share(x)} 100%, 100% ${share(y)}`,
  };
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
  props.formatValue
    ? props.formatValue(point)
    : `${describeAxis(point.x, props.xDomain, props.xUnit)} · ${describeAxis(point.y, props.yDomain, props.yUnit)}`;

/** A segment's bend as a signed percentage: positive holds the start of the segment, negative the end. */
const describeCurve = (curve = 0) =>
  `Curve ${curve > 0 ? "+" : ""}${Math.round(curve * 100)}%`;
</script>

<template>
  <div
    data-slot="envelope-frame"
    :class="$attrs.class"
    :data-size="size"
    :style="gridLines"
  >
    <Envelope.Root v-bind="forRoot($attrs)" role="group" :snap="snap">
      <template #default="{ state }">
        <Envelope.Graph>
          <Envelope.Fill />
          <Envelope.Line />
        </Envelope.Graph>
        <template v-if="curves">
          <Envelope.Segment
            v-for="(_, index) in state.value.slice(0, -1)"
            :key="`segment-${index}`"
            :aria-label="`Curve ${index + 1}`"
            :index="index"
          >
            <span aria-hidden="true" data-slot="envelope-segment-value">{{
              describeCurve(state.value[index]?.curve)
            }}</span>
          </Envelope.Segment>
        </template>
        <Envelope.Point
          v-for="(point, index) in state.value"
          :key="`point-${index}`"
          :aria-label="`Point ${index + 1} of ${state.value.length}`"
          :get-aria-value-text="describe"
          :index="index"
        >
          <span
            aria-hidden="true"
            data-slot="envelope-point-value"
            :data-below="point.y > LABEL_FLIP_ABOVE ? '' : undefined"
            >{{
              describe(point)
            }}</span
          >
        </Envelope.Point>
      </template>
    </Envelope.Root>
  </div>
</template>
