<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import type { Note } from "@/primitives/piano-roll";
import { type Known, parts } from "./parts";

/** A bar under a note, in a `VelocityLane`: its height is the note's velocity, or its chance, which a drag or the keys set through its native input. */
let {
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children: content,
  getAriaValueText,
  level,
  note,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Velocity>>, "children" | "note"> & {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: Snippet;
  getAriaValueText?: (velocity: number) => string;
  note: Note;
} = $props();
</script>

<parts.Velocity {...rest} {level} note={note.id}>
  {#snippet children()}
    {@render content?.()}
    <parts.VelocityInput
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
      {getAriaValueText}
      {level}
      note={note.id}
    />
  {/snippet}
</parts.Velocity>
