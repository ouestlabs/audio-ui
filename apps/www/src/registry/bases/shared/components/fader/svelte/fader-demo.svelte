<script lang="ts">
import Fader from "@/registry/bases/shared/audio-ui/elements/svelte/Fader.svelte";

const marks = [
  { label: "0", value: 0 },
  25,
  50,
  75,
  { label: "100", value: 100 },
];
</script>

<Fader
  aria-label="Volume"
  defaultValue={50}
  {marks}
  max={100}
  min={0}
  step={1}
/>
