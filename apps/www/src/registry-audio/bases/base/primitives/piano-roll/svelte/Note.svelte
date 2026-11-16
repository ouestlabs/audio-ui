<script lang="ts">
import type { Note } from "@audio-ui/primitives/piano-roll";
import type { ComponentProps } from "svelte";
import { type Known, parts } from "./parts";

/** One note on the roll: it moves by dragging its body, and the keys, and is a button that selects it. */
let {
  note,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Note>>, "note"> & { note: Note } =
  $props();
</script>

<parts.Note {...rest} note={note.id} />
