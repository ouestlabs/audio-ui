<script lang="ts">
import XYPad from "@/registry/bases/shared/audio-ui/elements/svelte/XYPad.svelte";
</script>

<XYPad
  aria-label="Position"
  defaultValue={{ x: 50, y: 50 }}
  maxX={100}
  maxY={100}
  minX={0}
  minY={0}
  style="width: 12rem"
/>
