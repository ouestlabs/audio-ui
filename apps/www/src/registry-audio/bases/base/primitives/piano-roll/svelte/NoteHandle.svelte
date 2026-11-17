<script lang="ts">
import type { Note } from "@/primitives/piano-roll";
import type { ComponentProps } from "svelte";
import { type Known, parts } from "./parts";

/** Resizes one edge of a note by dragging. */
let {
  edge,
  note,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.NoteStart>>, "note"> & {
  edge: "end" | "start";
  note: Note;
} = $props();
</script>

{#if edge === "start"}
  <parts.NoteStart {...rest} note={note.id} />
{:else}
  <parts.NoteEnd {...rest} note={note.id} />
{/if}
