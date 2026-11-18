<script lang="ts" setup>
import type { Note } from "@/primitives/piano-roll";
import { ref } from "vue";
import { PianoRoll } from "@/registry/bases/base/primitives/piano-roll/vue";

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
    class="cn-piano-roll group/piano-roll flex min-h-0 w-full min-w-0 flex-col overflow-hidden data-disabled:opacity-50"
    mode="select"
    :duration="16"
    :max-pitch="72"
    :min-pitch="48"
    :snap-step="0.25"
    :value="notes"
    @value-change="(next: Note[]) => { notes = next; }"
  >
    <PianoRoll.Grid
      class="cn-piano-roll-grid cn-piano-roll-size-default relative h-64 flex-1 touch-none select-none outline-none data-[mode=draw]:cursor-cell"
    >
      <PianoRoll.Rows>
        <template #default="{ pitch }">
          <PianoRoll.Row class="cn-piano-roll-row" :pitch="pitch" />
        </template>
      </PianoRoll.Rows>
      <PianoRoll.Notes>
        <template #default="{ note }">
          <PianoRoll.Note
            class="cn-piano-roll-note cursor-grab touch-none select-none border border-primary bg-[color-mix(in_oklab,var(--primary)_calc(30%_+_var(--piano-roll-velocity)_*_60%),transparent)] opacity-[calc(0.4+var(--piano-roll-chance)*0.6)] outline-none active:cursor-grabbing data-muted:border-muted-foreground data-muted:bg-muted data-[selected]:border-foreground data-[selected]:bg-primary data-[selected]:ring-1 data-[selected]:ring-foreground data-muted:data-[selected]:bg-muted-foreground/40"
            :note="note"
          >
            <PianoRoll.NoteHandle
              class="cn-piano-roll-note-handle absolute inset-y-0 w-[min(0.375rem,25%)] cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
              edge="start"
              :note="note"
            />
            <PianoRoll.NoteHandle
              class="cn-piano-roll-note-handle absolute inset-y-0 w-[min(0.375rem,25%)] cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
              edge="end"
              :note="note"
            />
          </PianoRoll.Note>
        </template>
      </PianoRoll.Notes>
      <PianoRoll.Marquee class="cn-piano-roll-marquee z-10" />
    </PianoRoll.Grid>
  </PianoRoll.Root>
</template>
