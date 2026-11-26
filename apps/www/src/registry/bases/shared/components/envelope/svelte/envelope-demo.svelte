<script lang="ts">
import Envelope from "@/registry/bases/shared/audio-ui/elements/svelte/Envelope.svelte";

const POINTS = [
  { x: 0, y: 0 },
  { x: 0.15, y: 1 },
  { x: 0.6, y: 0.5 },
  { x: 1, y: 0 },
];
</script>

<Envelope aria-label="Envelope" defaultValue={POINTS} />
