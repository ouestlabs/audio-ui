<script lang="ts" setup>
import { ref } from "vue";
import { XYPad } from "@/registry/bases/shared/primitives/xypad/vue";

const value = ref({ x: 50, y: 50 });
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <XYPad.Root
      class="data-disabled:cursor-not-allowed"
      :max-x="100"
      :max-y="100"
      :min-x="0"
      :min-y="0"
      :value="value"
      @value-change="(next) => {
        value = next;
      }"
    >
      <XYPad.Control
        class="cn-xypad cn-xypad-size-default relative block aspect-square w-full cursor-crosshair touch-none select-none overflow-hidden data-disabled:pointer-events-none data-disabled:opacity-50"
      >
        <div aria-hidden="true" class="pointer-events-none absolute inset-0">
          <div
            class="cn-xypad-grid-line absolute top-0 bottom-0 w-px"
            style="left: 20%"
          />
          <div
            class="cn-xypad-grid-line absolute top-0 bottom-0 w-px"
            style="left: 40%"
          />
          <div
            class="cn-xypad-grid-line absolute top-0 bottom-0 w-px"
            style="left: 60%"
          />
          <div
            class="cn-xypad-grid-line absolute top-0 bottom-0 w-px"
            style="left: 80%"
          />
          <div
            class="cn-xypad-grid-line absolute right-0 left-0 h-px"
            style="top: 20%"
          />
          <div
            class="cn-xypad-grid-line absolute right-0 left-0 h-px"
            style="top: 40%"
          />
          <div
            class="cn-xypad-grid-line absolute right-0 left-0 h-px"
            style="top: 60%"
          />
          <div
            class="cn-xypad-grid-line absolute right-0 left-0 h-px"
            style="top: 80%"
          />
        </div>
        <div
          aria-hidden="true"
          class="cn-xypad-crosshair pointer-events-none absolute top-0 bottom-0 left-(--xy-pad-x) w-px"
        />
        <div
          aria-hidden="true"
          class="cn-xypad-crosshair pointer-events-none absolute top-(--xy-pad-y) right-0 left-0 h-px"
        />
        <XYPad.Thumb
          aria-label="Position"
          class="pointer-events-none absolute size-5"
        >
          <div
            class="cn-xypad-cursor-glow absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none"
          />
          <div class="cn-xypad-cursor-dot absolute inset-1" />
          <div class="cn-xypad-cursor-highlight absolute inset-2" />
        </XYPad.Thumb>
        <XYPad.Value class="cn-xypad-value absolute top-2.5 right-2.5 z-10" />
      </XYPad.Control>
    </XYPad.Root>
    <output
      aria-live="polite"
      class="font-mono text-foreground text-sm tabular-nums"
    >
      X: {{ value.x }} - Y: {{ value.y }}
    </output>
  </div>
</template>
