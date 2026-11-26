<script lang="ts" setup>
import { Pad } from "@/registry/primitives/pad/vue";

/** A grid of pads to strike, `columns` to a row: put a `PadItem` in it for each. */
withDefaults(defineProps<{ columns?: number }>(), { columns: 4 });
</script>

<template>
  <Pad.Root :columns="columns" :style="{ '--pad-columns': columns }">
    <slot />
  </Pad.Root>
</template>
