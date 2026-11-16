<script lang="ts">
import { Plot } from "@/registry-audio/bases/base/primitives/plot/svelte/index.ts";

/** The plot the shared suite drives: its options and the parts to draw on it. */
let { tree }: { tree: Record<string, any> } = $props();
</script>

<Plot.Root {...tree.options}>
  {#if tree.grid}
    <Plot.Grid {...tree.grid} />
  {/if}
  {#if tree.band}
    <Plot.Band {...tree.band} />
  {/if}
  {#if tree.curve}
    <Plot.Curve {...tree.curve} />
  {/if}
  {#if tree.line}
    <Plot.Line {...tree.line} />
  {/if}
  {#if tree.trace}
    <Plot.Trace {...tree.trace} />
  {/if}
  {#if tree.mark}
    <Plot.Mark {...tree.mark} />
  {/if}
  {#if tree.dot}
    <Plot.Dot {...tree.dot} />
  {/if}
  {#if tree.handle}
    <Plot.Handle aria-label={tree.handle.label} {...tree.handle} />
  {/if}
  {#if tree.cursor}
    <Plot.Cursor
      ><Plot.CursorReadout format={tree.cursor.format} /></Plot.Cursor
    >
  {/if}
</Plot.Root>
