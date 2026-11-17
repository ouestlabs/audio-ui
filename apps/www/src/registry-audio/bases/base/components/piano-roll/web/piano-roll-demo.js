import "@/registry-audio/bases/base/primitives/piano-roll/web";

const NOTES = [
  { id: "1", length: 1, pitch: 60, start: 0 },
  { id: "2", length: 0.5, pitch: 63, start: 1 },
  { id: "3", length: 1.5, pitch: 67, start: 1.5 },
  { id: "4", length: 1, pitch: 65, start: 3 },
  { id: "5", length: 2, pitch: 62, start: 4 },
  { id: "6", length: 1, pitch: 69, start: 6 },
  { id: "7", length: 1, pitch: 67, start: 7 },
  { id: "8", length: 2, pitch: 60, start: 8 },
];

/** Draws the piano roll into `element`, and returns what takes it away. The rows and the notes are made for you: styled here from their tags. */
export default function pianoRollWebDemo(element) {
  element.innerHTML = `
    <style>
      audio-ui-piano-roll-row { border-bottom: 1px solid var(--border); }
      audio-ui-piano-roll-row[data-color="black"] { background: var(--muted); }
      audio-ui-piano-roll-note { border: 1px solid var(--primary); background: color-mix(in oklab, var(--primary) 70%, transparent); cursor: grab; }
      audio-ui-piano-roll-note[data-selected] { background: var(--primary); outline: 1px solid var(--foreground); }
      audio-ui-piano-roll-note-start, audio-ui-piano-roll-note-end { width: 0.375rem; cursor: ew-resize; }
      audio-ui-piano-roll-marquee { border: 1px solid var(--primary); background: color-mix(in oklab, var(--primary) 10%, transparent); z-index: 10; }
    </style>
    <audio-ui-piano-roll value='${JSON.stringify(NOTES)}' class="cn-piano-roll group/piano-roll flex min-h-0 w-full min-w-0 flex-col overflow-hidden data-disabled:opacity-50" duration="16" max-pitch="72" min-pitch="48" mode="select" snap-step="0.25">
      <audio-ui-piano-roll-grid class="cn-piano-roll-grid cn-piano-roll-size-default relative h-64 flex-1 touch-none select-none outline-none data-[mode=draw]:cursor-cell">
        <audio-ui-piano-roll-rows></audio-ui-piano-roll-rows>
        <audio-ui-piano-roll-notes handles></audio-ui-piano-roll-notes>
        <audio-ui-piano-roll-marquee></audio-ui-piano-roll-marquee>
      </audio-ui-piano-roll-grid>
    </audio-ui-piano-roll>`;
  return () => {
    element.innerHTML = "";
  };
}
