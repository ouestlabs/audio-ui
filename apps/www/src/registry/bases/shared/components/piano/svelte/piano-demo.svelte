<script lang="ts">
import { Piano } from "@/registry/primitives/piano/svelte/index";
</script>

<Piano.Root
  aria-label="Piano"
  class="cn-piano cn-piano-size-default w-full touch-none select-none overflow-hidden data-disabled:pointer-events-none data-disabled:opacity-50"
  maxPitch={72}
  minPitch={48}
>
  {#snippet children(
    state
  )}
    {#each state.pitches as pitch (pitch)}
      <Piano.Key class="cn-piano-key cursor-pointer" {pitch} />
    {/each}
  {/snippet}
</Piano.Root>
