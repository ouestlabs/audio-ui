<script lang="ts">
import { Timeline } from "@/registry-audio/bases/base/primitives/timeline/svelte/index.ts";

/** The timeline the shared suite drives: its options and the parts to draw on it. */
let { tree }: { tree: Record<string, any> } = $props();
</script>

{#snippet inner()}
  {#if tree.playhead}
    <Timeline.Playhead />
  {/if}
  {#if tree.mark}
    <Timeline.Mark {...tree.mark} />
  {/if}
{/snippet}

<Timeline.Root {...tree.options}>
  <Timeline.Viewport>
    {#if tree.ruler}
      <Timeline.Ruler aria-label={tree.ruler.label}>
        {#if !tree.lane}
          {@render inner()}
        {/if}
      </Timeline.Ruler>
    {/if}
    {#if tree.lane}
      <Timeline.Lane {...tree.lane}> {@render inner()} </Timeline.Lane>
    {/if}
    {#if tree.track}
      <Timeline.Track height={tree.track.height} track={tree.track.track}>
        <Timeline.TrackResizeHandle
          aria-label={tree.track.label}
          track={tree.track.track}
        />
      </Timeline.Track>
    {/if}
  </Timeline.Viewport>
</Timeline.Root>
