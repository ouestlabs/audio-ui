<script lang="ts">
import Pad from "@/registry/bases/shared/audio-ui/elements/svelte/Pad.svelte";
import PadItem from "@/registry/bases/shared/audio-ui/elements/svelte/PadItem.svelte";

let props = $props();
</script>

<Pad {...props}>
  <PadItem value="kick">Kick</PadItem>
  <PadItem value="snare">Snare</PadItem>
</Pad>
