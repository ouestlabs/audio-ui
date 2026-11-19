<script lang="ts" setup>
import { Knob } from "@/registry/primitives/knob/vue";
</script>

<template>
  <Knob.Root
    class="cn-knob cn-knob-size-lg group/knob relative m-5 mb-12 inline-flex outline-none data-disabled:cursor-not-allowed"
    :default-value="50"
    :max="100"
    :min="0"
    :step="1"
  >
    <Knob.Control
      class="cn-knob-control transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] focus-visible:outline-none active:cursor-grabbing data-disabled:pointer-events-none data-disabled:opacity-50 data-[drag-mode=vertical]:cursor-ns-resize data-[drag-mode=vertical]:active:cursor-ns-resize"
    >
      <div class="cn-knob-body cn-knob-body-size-lg absolute z-0" />
      <Knob.Track
        class="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full opacity-22"
      />
      <Knob.Indicator
        class="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full"
      />
      <Knob.Thumb
        aria-label="Level"
        class="pointer-events-none absolute inset-0 z-2"
      >
        <svg
          aria-hidden="true"
          class="cn-knob-indicator block size-full"
          viewBox="0 0 48 48"
        >
          <line
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="2.75"
            x1="24"
            x2="24"
            y1="11.53"
            y2="18.84"
          />
        </svg>
      </Knob.Thumb>
    </Knob.Control>
    <Knob.Mark :value="0">
      <span
        class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"
      ></span>
      <span
        class="cn-knob-mark-label -top-6 absolute left-1/2 -translate-x-1/2 [rotate:calc(var(--knob-mark-angle)*-1)]"
        >0</span
      >
    </Knob.Mark>
    <Knob.Mark :value="25">
      <span
        class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"
      ></span>
    </Knob.Mark>
    <Knob.Mark :value="50">
      <span
        class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"
      ></span>
    </Knob.Mark>
    <Knob.Mark :value="75">
      <span
        class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"
      ></span>
    </Knob.Mark>
    <Knob.Mark :value="100">
      <span
        class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"
      ></span>
      <span
        class="cn-knob-mark-label -top-6 absolute left-1/2 -translate-x-1/2 [rotate:calc(var(--knob-mark-angle)*-1)]"
        >100</span
      >
    </Knob.Mark>
    <Knob.Value
      class="cn-knob-value absolute top-full left-1/2 z-10 mt-6 -translate-x-1/2 cursor-text whitespace-nowrap opacity-0 transition-opacity duration-150 ease-out group-hover/knob:opacity-100 group-has-focus-visible/knob:opacity-100 group-data-dragging/knob:opacity-100 data-editing:opacity-100 motion-reduce:transition-none"
      editable
    />
  </Knob.Root>
</template>
