<script lang="ts">
import Meter from "@/registry/bases/shared/audio-ui/elements/svelte/Meter.svelte";
import { createSimulatedLevels } from "@/registry/lib/devices/simulated-levels";

// The marks of a dBFS scale, down to the floor.
const scale = [6, 0, -6, -12, -20, -30, -40, -60];

const simulated = createSimulatedLevels(2);
$effect(() => simulated.run());
</script>

<Meter
  aria-label="Stereo output"
  marks={scale}
  source={simulated.source}
  warnThreshold={-12}
/>
