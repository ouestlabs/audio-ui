<script lang="ts">
import type { Note } from "@/primitives/piano-roll";
import { PianoRoll } from "@/registry/primitives/piano-roll/svelte/index";

const NOTES: Note[] = [
  { id: "1", length: 1, pitch: 60, start: 0 },
  { id: "2", length: 0.5, pitch: 63, start: 1 },
  { id: "3", length: 1.5, pitch: 67, start: 1.5 },
  { id: "4", length: 1, pitch: 65, start: 3 },
  { id: "5", length: 2, pitch: 62, start: 4 },
  { id: "6", length: 1, pitch: 69, start: 6 },
  { id: "7", length: 1, pitch: 67, start: 7 },
  { id: "8", length: 2, pitch: 60, start: 8 },
];

let notes = $state<Note[]>(NOTES);
</script>

<PianoRoll.Root
  duration={16}
  maxPitch={72}
  minPitch={48}
  mode="select"
  onValueChange={(next) => {
    notes = next;
  }}
  snapStep={0.25}
  value={notes}
>
  <PianoRoll.Grid style="position: relative; height: 16rem">
    <PianoRoll.Rows>
      {#snippet children(
        pitch
      )}
        <PianoRoll.Row {pitch} />
      {/snippet}
    </PianoRoll.Rows>
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
</PianoRoll.Root>
