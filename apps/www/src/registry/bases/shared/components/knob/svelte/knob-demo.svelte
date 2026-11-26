<script lang="ts">
import Knob from "@/registry/bases/shared/audio-ui/elements/svelte/Knob.svelte";

const marks = [
  { label: "0", value: 0 },
  25,
  50,
  75,
  { label: "100", value: 100 },
];
</script>

<Knob
  aria-label="Level"
  defaultValue={50}
  {marks}
  max={100}
  min={0}
  size="lg"
  step={1}
/>
