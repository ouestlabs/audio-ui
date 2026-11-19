<script lang="ts">
import { Waveform } from "@/registry/primitives/waveform/svelte/index.ts";

/** The waveform the shared suite drives: its options and the parts to draw on it. */
let { tree }: { tree: Record<string, any> } = $props();
</script>

<Waveform.Root {...tree.options}>
  {#if tree.control}
    <Waveform.Control aria-label={tree.control.label} />
  {/if}
  {#if tree.playhead}
    <Waveform.Playhead />
  {/if}
  {#if tree.thumb}
    <Waveform.Thumb />
  {/if}
  {#if tree.marker}
    <Waveform.Marker {...tree.marker} />
  {/if}
  {#if tree.hover}
    <Waveform.Hover {...tree.hover} />
  {/if}
  {#if tree.bars}
    <Waveform.Bars {...tree.bars} />
  {/if}
  {#if tree.canvas}
    <Waveform.Canvas />
  {/if}
  {#if tree.region}
    <Waveform.Region
      defaultValue={tree.region.defaultValue}
      region={tree.region.region}
      value={tree.region.value}
    >
      <Waveform.RegionHandle
        aria-label={tree.region.label
          ? `${tree.region.label} start`
          : undefined}
        edge="start"
        region={tree.region.region}
      />
      <Waveform.RegionHandle
        aria-label={tree.region.label ? `${tree.region.label} end` : undefined}
        edge="end"
        region={tree.region.region}
      />
    </Waveform.Region>
  {/if}
</Waveform.Root>
