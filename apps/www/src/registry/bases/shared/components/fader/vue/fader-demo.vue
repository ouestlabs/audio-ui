<script lang="ts" setup>
import { Fader } from "@/registry/bases/shared/primitives/fader/vue";
</script>

<template>
  <Fader.Root
    class="group/fader relative data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-disabled:cursor-not-allowed data-[orientation=horizontal]:pb-6 data-[orientation=vertical]:ps-10"
    orientation="vertical"
    :default-value="50"
    :max="100"
    :min="0"
    :step="1"
  >
    <Fader.Control
      class="relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-[var(--fader-min-height,10rem)] data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32 transition-opacity duration-150 ease-out motion-reduce:transition-none data-disabled:pointer-events-none data-disabled:opacity-50"
    >
      <Fader.Track
        class="cn-fader-track cn-fader-track-size-default relative grow cursor-pointer select-none overflow-hidden"
      >
        <Fader.Indicator
          class="cn-fader-range absolute select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full data-[orientation=vertical]:bottom-0"
        />
      </Fader.Track>
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 end-[calc(50%+0.75rem)]"
      >
        <Fader.Mark
          class="flex items-center gap-1 end-0 translate-y-1/2 flex-row"
          :value="0"
        >
          <span class="cn-fader-mark-label">0</span>
          <span class="cn-fader-mark-tick h-px w-1.5" />
        </Fader.Mark>
        <Fader.Mark
          class="flex items-center gap-1 end-0 translate-y-1/2 flex-row"
          :value="25"
        >
          <span class="cn-fader-mark-tick h-px w-1.5" />
        </Fader.Mark>
        <Fader.Mark
          class="flex items-center gap-1 end-0 translate-y-1/2 flex-row"
          :value="50"
        >
          <span class="cn-fader-mark-tick h-px w-1.5" />
        </Fader.Mark>
        <Fader.Mark
          class="flex items-center gap-1 end-0 translate-y-1/2 flex-row"
          :value="75"
        >
          <span class="cn-fader-mark-tick h-px w-1.5" />
        </Fader.Mark>
        <Fader.Mark
          class="flex items-center gap-1 end-0 translate-y-1/2 flex-row"
          :value="100"
        >
          <span class="cn-fader-mark-label">100</span>
          <span class="cn-fader-mark-tick h-px w-1.5" />
        </Fader.Mark>
      </div>
      <Fader.Thumb
        aria-label="Volume"
        class="cn-fader-thumb cn-fader-thumb-size-default before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-disabled:pointer-events-none"
      >
        <div
          class="cn-fader-thumb-inner-size-default flex h-full w-full items-center justify-center gap-0.5 data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col"
          data-orientation="vertical"
        >
          <div
            class="cn-fader-thumb-mark cn-fader-thumb-mark-size-default"
            data-orientation="vertical"
          />
          <div
            class="cn-fader-thumb-mark cn-fader-thumb-mark-size-default"
            data-orientation="vertical"
          />
          <div
            class="cn-fader-thumb-mark cn-fader-thumb-mark-size-default"
            data-orientation="vertical"
          />
        </div>
        <Fader.Value
          class="cn-fader-value absolute z-20 whitespace-nowrap cursor-text start-full top-1/2 ms-2 -translate-y-1/2 opacity-0 transition-opacity duration-150 ease-out group-hover/fader:opacity-100 group-has-focus-visible/fader:opacity-100 group-has-data-dragging/fader:opacity-100 data-editing:opacity-100 motion-reduce:transition-none"
          editable
        />
      </Fader.Thumb>
    </Fader.Control>
  </Fader.Root>
</template>
