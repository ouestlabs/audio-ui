<script lang="ts">
import { PianoRoll } from "@/registry/bases/base/primitives/piano-roll/svelte/index.ts";

/** The roll the shared suite drives: its options and the parts to draw on it. */
let { tree }: { tree: Record<string, any> } = $props();
</script>

<PianoRoll.Root {...tree.options}>
  <PianoRoll.Grid>
    <PianoRoll.Rows>
      {#snippet children(
        pitch
      )}
        <PianoRoll.Row {pitch} />
      {/snippet}
    </PianoRoll.Rows>
    <PianoRoll.SelectionSpan>
      <PianoRoll.StretchHandle edge="start" />
      <PianoRoll.StretchHandle edge="end" />
    </PianoRoll.SelectionSpan>
    <PianoRoll.Notes>
      {#snippet children(
        note
      )}
        <PianoRoll.Note {note}>
          <PianoRoll.NoteHandle edge="start" {note} />
          <PianoRoll.NoteHandle edge="end" {note} />
        </PianoRoll.Note>
      {/snippet}
    </PianoRoll.Notes>
    <PianoRoll.Marquee />
  </PianoRoll.Grid>
  <PianoRoll.VelocityLane>
    <PianoRoll.Notes>
      {#snippet children(
        note
      )}
        <PianoRoll.Velocity {note} />
      {/snippet}
    </PianoRoll.Notes>
  </PianoRoll.VelocityLane>
</PianoRoll.Root>
