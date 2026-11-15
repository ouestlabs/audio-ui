<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { parts } from "./parts.ts";

/** Sets the track's height: by dragging, or from the keyboard through its native input. A double-click gives the height up. */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  track,
  ...rest
}: Omit<ComponentProps<typeof parts.TrackResizeHandle>, "children"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
} = $props();
</script>

<parts.TrackResizeHandle {...rest} {track}>
  {#snippet children()}
    {@render content?.()}
    <parts.TrackResizeInput
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
      {track}
    />
  {/snippet}
</parts.TrackResizeHandle>
