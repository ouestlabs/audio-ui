<script lang="ts">
import type { Note } from "@audio-ui/primitives/piano-roll";
import type { ComponentProps } from "svelte";
import { parts } from "./parts.ts";

/** One note on the roll: it moves by dragging its body, and the keys, and is a button that selects it. */
let {
  note,
  ...rest
}: Omit<ComponentProps<typeof parts.Note>, "note"> & { note: Note } = $props();
</script>

<parts.Note {...rest} note={note.id} />
