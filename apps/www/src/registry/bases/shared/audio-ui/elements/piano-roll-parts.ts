export const NOTE_HANDLE =
  "cn-piano-roll-note-handle absolute inset-y-0 w-[min(0.375rem,25%)] cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0";
export const STRETCH_HANDLE =
  "cn-piano-roll-stretch-handle z-10 w-2 cursor-ew-resize bg-primary data-[edge=end]:translate-x-1/2 data-[edge=start]:-translate-x-1/2";
const SIZED = (part: string) => ({
  [`${part}:where(:not([data-size]),[data-size=default])`]:
    "cn-piano-roll-size-default",
  [`${part}[data-size=lg]`]: "cn-piano-roll-size-lg",
  [`${part}[data-size=sm]`]: "cn-piano-roll-size-sm",
});

/**
 * How each part of the piano roll is drawn, by its `data-slot`. A part's look
 * follows its attributes, never the props: the React roll applies these
 * classes, and `registry:build` writes them as plain CSS on the parts for
 * every other framework, where the parts are composed as here and laid out by
 * their author. The keys and the grid carry `data-size`; a key's label,
 * `data-octave` on a C, which names its octave.
 */
export const pianoRollParts = Object.freeze({
  "piano-roll":
    "cn-piano-roll group/piano-roll flex min-h-0 w-full min-w-0 flex-col overflow-hidden [--piano-roll-keys-width:3.5rem] data-disabled:opacity-50",
  "piano-roll-keys": "cn-piano-roll-keys flex-1 touch-none select-none",
  ...SIZED("piano-roll-keys"),
  "piano-roll-keys piano-key":
    "cn-piano-roll-key inset-x-0 flex cursor-pointer items-center justify-end pe-1.5 text-[10px] outline-none",
  // Only C names its row, where octaves are counted from; folded, every row does.
  "piano-roll-keys piano-label": "hidden group-data-folded/piano-roll:inline",
  "piano-roll-keys piano-label[data-octave]": "inline",
  "piano-roll-grid":
    "cn-piano-roll-grid flex-1 touch-none select-none outline-none data-[mode=draw]:cursor-cell",
  ...SIZED("piano-roll-grid"),
  "piano-roll-row": "cn-piano-roll-row",
  "piano-roll-note":
    "cn-piano-roll-note cursor-grab touch-none select-none border border-primary bg-[color-mix(in_oklab,var(--primary)_calc(30%_+_var(--piano-roll-velocity)_*_60%),transparent)] opacity-[calc(0.4+var(--piano-roll-chance)*0.6)] outline-none active:cursor-grabbing data-muted:border-muted-foreground data-muted:bg-muted data-[selected]:border-foreground data-[selected]:bg-primary data-[selected]:ring-1 data-[selected]:ring-foreground data-muted:data-[selected]:bg-muted-foreground/40",
  "piano-roll-note-start": NOTE_HANDLE,
  "piano-roll-note-end": NOTE_HANDLE,
  "piano-roll-marquee": "cn-piano-roll-marquee z-10",
  "piano-roll-selection-span": "cn-piano-roll-selection",
  "piano-roll-velocity-lane":
    "cn-piano-roll-velocity touch-none select-none data-[mode=draw]:cursor-crosshair",
  "piano-roll-velocity":
    "cn-piano-roll-velocity-bar w-1.5 cursor-ns-resize after:absolute after:-inset-x-1 after:inset-y-0 group-data-[mode=draw]/piano-roll:cursor-crosshair",
  "piano-roll-stretch-start": STRETCH_HANDLE,
  "piano-roll-stretch-end": STRETCH_HANDLE,
});
