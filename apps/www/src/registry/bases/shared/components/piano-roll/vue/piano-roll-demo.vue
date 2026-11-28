<script lang="ts" setup>
import { ref } from "vue";
import type { Note } from "@/primitives/piano-roll";
import { PianoRoll } from "@/registry/primitives/piano-roll/vue";

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

const notes = ref<Note[]>(NOTES);
</script>

<template>
  <PianoRoll.Root
    mode="select"
    :duration="16"
    :max-pitch="72"
    :min-pitch="48"
    :snap-step="0.25"
    :value="notes"
    @value-change="(next: Note[]) => { notes = next; }"
  >
    <PianoRoll.Grid style="position: relative; height: 16rem">
      <PianoRoll.Rows>
        <template #default="{ pitch }">
          <PianoRoll.Row :pitch="pitch" />
        </template>
      </PianoRoll.Rows>
      <PianoRoll.Notes>
        <template #default="{ note }">
          <PianoRoll.Note :note="note">
            <PianoRoll.NoteHandle edge="start" :note="note" />
            <PianoRoll.NoteHandle edge="end" :note="note" />
          </PianoRoll.Note>
        </template>
      </PianoRoll.Notes>
      <PianoRoll.Marquee />
    </PianoRoll.Grid>
  </PianoRoll.Root>
</template>
