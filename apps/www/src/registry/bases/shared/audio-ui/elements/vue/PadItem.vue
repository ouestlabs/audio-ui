<script lang="ts" setup>
import { Pad } from "@/registry/primitives/pad/vue";
</script>

<!-- One pad: give it a `value`, and a label as its content or `aria-label`. -->
<template>
  <Pad.Item>
    <slot />
  </Pad.Item>
</template>
