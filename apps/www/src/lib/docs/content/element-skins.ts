/**
 * How each custom element is styled in its examples, written twice for the
 * same look: a stylesheet on the parts' tags, and Tailwind classes on the
 * parts. The live previews wear the one the reader chose, and the snippets
 * show it, so what is on screen is what is copied. A part that holds
 * generated children (the keys of a piano, the points of an envelope) styles
 * them from itself, with `*:` in Tailwind and a descendant selector in CSS.
 *
 * Colors and radius are the theme's variables (`--primary`, `--muted`,
 * `--border`, `--radius`...), so the customizer's accent, radius and font
 * restyle every example at once.
 */
export interface ElementSkin {
  /** The stylesheet, plain CSS. */
  css: string;
  /** The classes of each part, by its tag. */
  tailwind: Readonly<Record<string, string>>;
}

export const SKINS: Record<string, ElementSkin> = {
  envelope: {
    css: `audio-ui-envelope {
  display: block;
  width: 100%;
  max-width: 28rem;
  height: calc(var(--spacing, 0.25rem) * 40);
  border-radius: calc(var(--radius) - 2px);
  background: var(--muted);
}

audio-ui-envelope-fill {
  color: var(--primary);
  opacity: 0.15;
}

audio-ui-envelope-line {
  color: var(--primary);
  stroke-width: 2px;
}

audio-ui-envelope-point {
  box-sizing: border-box;
  width: calc(var(--spacing, 0.25rem) * 3);
  height: calc(var(--spacing, 0.25rem) * 3);
  border: 2px solid var(--primary);
  border-radius: 9999px;
  background: var(--background);
  cursor: grab;
  outline: none;
}

audio-ui-envelope-point:focus-visible,
audio-ui-envelope-point[data-dragging] {
  background: var(--primary);
}

audio-ui-envelope-segment {
  width: calc(var(--spacing, 0.25rem) * 2);
  height: calc(var(--spacing, 0.25rem) * 2);
  border-radius: 9999px;
  background: var(--muted-foreground);
  opacity: 0.5;
  cursor: ns-resize;
  outline: none;
}

audio-ui-envelope-segment[data-flat] {
  display: none;
}`,
    tailwind: {
      "audio-ui-envelope": "block h-40 w-full max-w-md rounded-md bg-muted",
      "audio-ui-envelope-fill": "text-primary opacity-15",
      "audio-ui-envelope-line": "text-primary [stroke-width:2px]",
      "audio-ui-envelope-points":
        "*:size-3 *:cursor-grab *:rounded-full *:border-2 *:border-primary *:bg-background *:outline-none *:focus-visible:bg-primary *:data-dragging:bg-primary",
      "audio-ui-envelope-segments":
        "*:size-2 *:cursor-ns-resize *:rounded-full *:bg-muted-foreground *:opacity-50 *:outline-none *:data-flat:hidden",
    },
  },
  fader: {
    css: `audio-ui-fader {
  position: relative;
  height: calc(var(--spacing, 0.25rem) * 40);
}

audio-ui-fader-control {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: auto;
  height: 100%;
  touch-action: none;
  user-select: none;
}

audio-ui-fader-track {
  position: relative;
  flex-grow: 1;
  width: calc(var(--spacing, 0.25rem) * 2);
  overflow: hidden;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--input) 90%, transparent);
  cursor: pointer;
  user-select: none;
}

audio-ui-fader-indicator {
  position: absolute;
  width: 100%;
  background: var(--primary);
  user-select: none;
}

audio-ui-fader-thumb {
  position: absolute;
  z-index: 10;
  display: block;
  flex-shrink: 0;
  width: calc(var(--spacing, 0.25rem) * 4);
  height: calc(var(--spacing, 0.25rem) * 6);
  border: 1px solid var(--ring);
  border-radius: calc(var(--radius) - 2px);
  background: var(--card);
  outline: none;
  cursor: grab;
  user-select: none;
  transition: box-shadow 150ms;
}

audio-ui-fader-thumb:hover {
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--ring) 40%, transparent);
}

audio-ui-fader-thumb:has(:focus-visible),
audio-ui-fader-thumb:active {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent);
}

audio-ui-fader-thumb:active {
  cursor: grabbing;
}`,
    tailwind: {
      "audio-ui-fader": "relative h-40",
      "audio-ui-fader-control":
        "relative flex h-full w-auto touch-none select-none flex-col items-center",
      "audio-ui-fader-indicator": "absolute w-full select-none bg-primary",
      "audio-ui-fader-thumb":
        "absolute z-10 block h-6 w-4 shrink-0 cursor-grab select-none rounded-md border border-ring bg-card outline-none transition-shadow hover:ring-2 hover:ring-ring/40 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:cursor-grabbing active:ring-3 active:ring-ring/50",
      "audio-ui-fader-track":
        "relative w-2 grow cursor-pointer select-none overflow-hidden rounded-full bg-input/90",
    },
  },
  knob: {
    css: `audio-ui-knob {
  position: relative;
  display: inline-flex;
  width: calc(var(--spacing, 0.25rem) * 12);
  height: calc(var(--spacing, 0.25rem) * 12);
  margin-bottom: calc(var(--spacing, 0.25rem) * 8);
  outline: none;
}

audio-ui-knob-control {
  position: relative;
  isolation: isolate;
  display: flex;
  width: 100%;
  height: 100%;
  clip-path: circle(50% at 50% 50%);
  cursor: grab;
  outline: none;
  touch-action: none;
  user-select: none;
}

audio-ui-knob-control:active {
  cursor: grabbing;
}

/* The knob's face. */
audio-ui-knob-control::before {
  content: "";
  position: absolute;
  inset: calc(var(--spacing, 0.25rem) * 1.5);
  border-radius: 9999px;
  background: var(--card);
  box-shadow: 0 0 0 1px color-mix(in oklab, var(--foreground) 10%, transparent);
}

audio-ui-knob-track,
audio-ui-knob-indicator {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  color: var(--primary);
  pointer-events: none;
}

audio-ui-knob-track {
  opacity: 0.22;
}

audio-ui-knob-track path,
audio-ui-knob-indicator path {
  stroke: currentColor;
}

audio-ui-knob-thumb {
  position: absolute;
  inset: 0;
  z-index: 2;
  color: var(--primary);
  pointer-events: none;
}

/* The mark on the face: the thumb turns with the value. */
audio-ui-knob-thumb::after {
  content: "";
  position: absolute;
  top: 24%;
  left: 50%;
  width: 6%;
  height: 15%;
  translate: -50% 0;
  border-radius: 9999px;
  background: currentColor;
}

audio-ui-knob-value {
  position: absolute;
  top: 100%;
  left: 50%;
  z-index: 10;
  margin-top: calc(var(--spacing, 0.25rem) * 1);
  padding: calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 1.5);
  translate: -50% 0;
  border-radius: calc(var(--radius) - 4px);
  background: var(--foreground);
  color: var(--background);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}

audio-ui-knob-label {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}`,
    tailwind: {
      "audio-ui-knob": "relative mb-8 inline-flex size-12 outline-none",
      "audio-ui-knob-control":
        "relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] before:absolute before:inset-1.5 before:rounded-full before:bg-card before:ring-1 before:ring-foreground/10 before:content-[''] active:cursor-grabbing",
      "audio-ui-knob-indicator":
        "pointer-events-none absolute inset-0 z-1 block size-full text-primary [&_path]:stroke-current",
      "audio-ui-knob-label": "sr-only",
      "audio-ui-knob-thumb":
        "pointer-events-none absolute inset-0 z-2 text-primary after:absolute after:top-[24%] after:left-1/2 after:h-[15%] after:w-[6%] after:-translate-x-1/2 after:rounded-full after:bg-current after:content-['']",
      "audio-ui-knob-track":
        "pointer-events-none absolute inset-0 z-1 block size-full text-primary opacity-22 [&_path]:stroke-current",
      "audio-ui-knob-value":
        "pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm bg-foreground px-1.5 py-0.5 font-medium text-[10px] text-background tabular-nums leading-none",
    },
  },
  meter: {
    css: `audio-ui-meter {
  display: flex;
  gap: calc(var(--spacing, 0.25rem) * 1.5 * var(--density, 1));
  height: calc(var(--spacing, 0.25rem) * 44);
}

audio-ui-meter-channel {
  position: relative;
  display: block;
  width: calc(var(--spacing, 0.25rem) * 3);
  height: 100%;
  overflow: hidden;
  border-radius: calc(var(--radius) - 4px);
  background: var(--muted);
}

audio-ui-meter-indicator {
  position: absolute;
  bottom: 0;
  display: block;
  background: var(--primary);
}

audio-ui-meter-peak {
  position: absolute;
  right: 0;
  left: 0;
  display: block;
  height: calc(var(--spacing, 0.25rem) * 0.5);
  background: var(--foreground);
}`,
    tailwind: {
      "audio-ui-meter":
        "flex h-44 gap-[calc(var(--spacing)*1.5*var(--density,1))]",
      "audio-ui-meter-channel":
        "relative block h-full w-3 overflow-hidden rounded-sm bg-muted",
      "audio-ui-meter-indicator": "absolute bottom-0 block bg-primary",
      "audio-ui-meter-peak": "absolute inset-x-0 block h-0.5 bg-foreground",
    },
  },
  pad: {
    css: `audio-ui-pad {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: calc(var(--spacing, 0.25rem) * 2 * var(--density, 1));
  width: calc(var(--spacing, 0.25rem) * 72);
}

audio-ui-pad-item {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: calc(var(--radius) - 2px);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 1rem;
  outline: none;
  user-select: none;
  transition:
    color 150ms,
    background-color 150ms;
}

audio-ui-pad-item:focus-visible {
  box-shadow: 0 0 0 2px var(--ring);
}

audio-ui-pad-item[data-active] {
  background: var(--primary);
  color: var(--primary-foreground);
}`,
    tailwind: {
      "audio-ui-pad":
        "grid w-72 grid-cols-4 gap-[calc(var(--spacing)*2*var(--density,1))]",
      "audio-ui-pad-item":
        "flex aspect-square select-none items-center justify-center rounded-md bg-muted text-muted-foreground text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-active:bg-primary data-active:text-primary-foreground",
    },
  },
  piano: {
    css: `audio-ui-piano {
  position: relative;
  display: block;
  width: 100%;
  max-width: 32rem;
  height: calc(var(--spacing, 0.25rem) * 28);
}

audio-ui-piano-key {
  z-index: 0;
  top: 0;
  box-sizing: border-box;
  height: 100%;
  border: 1px solid var(--border);
  border-radius: 0 0 4px 4px;
  background: var(--background);
  cursor: pointer;
  outline: none;
}

audio-ui-piano-key[data-color="black"] {
  z-index: 1;
  height: 62%;
  border-color: var(--foreground);
  background: var(--foreground);
}

audio-ui-piano-key[data-active] {
  border-color: var(--primary);
  background: var(--primary);
}`,
    tailwind: {
      "audio-ui-piano": "relative block h-28 w-full max-w-lg",
      "audio-ui-piano-keys":
        "*:top-0 *:z-0 *:h-full *:cursor-pointer *:rounded-b-[4px] *:border *:border-border *:bg-background *:outline-none *:data-[color=black]:z-1 *:data-[color=black]:h-[62%] *:data-[color=black]:border-foreground *:data-[color=black]:bg-foreground *:data-active:border-primary *:data-active:bg-primary",
    },
  },
  "piano-roll": {
    css: `audio-ui-timeline {
  display: block;
  width: 100%;
  max-width: 36rem;
}

audio-ui-piano-roll {
  display: grid;
  grid-template-columns: 3rem 1fr;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
}

audio-ui-piano-roll-keys {
  height: calc(var(--spacing, 0.25rem) * 48);
  border-inline-end: 1px solid var(--border);
}

audio-ui-piano-roll-keys audio-ui-piano {
  display: block;
  height: 100%;
}

audio-ui-piano-roll-keys audio-ui-piano-key {
  z-index: 0;
  top: auto;
  right: 0;
  left: 0;
  box-sizing: border-box;
  height: 100%;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  background: var(--background);
  cursor: pointer;
  outline: none;
}

audio-ui-piano-roll-keys audio-ui-piano-key[data-color="black"] {
  z-index: 1;
  right: 35%;
  height: 62%;
  border-color: var(--foreground);
  background: var(--foreground);
}

audio-ui-piano-roll-keys audio-ui-piano-key[data-active] {
  border-color: var(--primary);
  background: var(--primary);
}

audio-ui-piano-roll-grid {
  height: calc(var(--spacing, 0.25rem) * 48);
  outline: none;
}

audio-ui-piano-roll-row[data-color="black"] {
  background: color-mix(in oklab, var(--muted) 70%, transparent);
}

audio-ui-piano-roll-row[data-octave] {
  border-bottom: 1px solid var(--border);
}

audio-ui-piano-roll-note {
  border-radius: 2px;
  background: color-mix(
    in oklab,
    var(--primary) calc(40% + 60% * var(--piano-roll-velocity)),
    transparent
  );
  cursor: grab;
  outline: none;
}

audio-ui-piano-roll-note[data-selected] {
  box-shadow: 0 0 0 2px var(--ring);
}

audio-ui-piano-roll-marquee {
  border: 1px dashed var(--primary);
  background: color-mix(in oklab, var(--primary) 8%, transparent);
}

audio-ui-piano-roll-velocity-lane {
  grid-column-start: 2;
  height: calc(var(--spacing, 0.25rem) * 12);
  border-top: 1px solid var(--border);
}

audio-ui-piano-roll-velocity {
  width: 3px;
  translate: -1px 0;
  background: var(--primary);
}

audio-ui-timeline-viewport {
  scrollbar-width: none;
}

audio-ui-timeline-playhead {
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--foreground);
}`,
    tailwind: {
      "audio-ui-piano": "block h-full",
      "audio-ui-piano-keys":
        "*:inset-x-0 *:top-auto *:z-0 *:h-full *:cursor-pointer *:border-0 *:border-border *:border-b *:bg-background *:outline-none *:data-[color=black]:right-[35%] *:data-[color=black]:z-1 *:data-[color=black]:h-[62%] *:data-[color=black]:border-foreground *:data-[color=black]:bg-foreground *:data-active:border-primary *:data-active:bg-primary",
      "audio-ui-piano-roll":
        "grid grid-cols-[3rem_1fr] overflow-hidden rounded-md border",
      "audio-ui-piano-roll-grid": "h-48 outline-none",
      "audio-ui-piano-roll-keys": "h-48 border-e",
      "audio-ui-piano-roll-marquee":
        "border border-primary border-dashed bg-primary/8",
      "audio-ui-piano-roll-notes":
        "*:cursor-grab *:rounded-[2px] *:bg-[color-mix(in_oklab,var(--primary)_calc(40%+60%*var(--piano-roll-velocity)),transparent)] *:outline-none *:data-selected:ring-2 *:data-selected:ring-ring",
      "audio-ui-piano-roll-rows":
        "*:data-[color=black]:bg-muted/70 *:data-octave:border-b",
      "audio-ui-piano-roll-velocities":
        "*:w-[3px] *:-translate-x-px *:bg-primary",
      "audio-ui-piano-roll-velocity-lane": "col-start-2 h-12 border-t",
      "audio-ui-timeline": "block w-full max-w-xl",
      "audio-ui-timeline-playhead": "inset-y-0 w-px bg-foreground",
      "audio-ui-timeline-viewport": "[scrollbar-width:none]",
    },
  },
  plot: {
    css: `audio-ui-plot {
  display: block;
  width: 100%;
  max-width: 32rem;
  height: calc(var(--spacing, 0.25rem) * 44);
  border-radius: calc(var(--radius) - 2px);
  background: var(--muted);
}

audio-ui-plot-grid {
  color: var(--muted-foreground);
  font-size: 10px;
}

audio-ui-plot-grid [data-part="line"] {
  stroke: var(--border);
}

audio-ui-plot-grid [data-part="label"][data-axis="x"] {
  bottom: calc(var(--spacing, 0.25rem) * 1);
  translate: 0.25rem 0;
}

audio-ui-plot-grid [data-part="label"][data-axis="y"] {
  left: calc(var(--spacing, 0.25rem) * 1);
  translate: 0 -100%;
}

audio-ui-plot-curve {
  color: color-mix(in oklab, var(--primary) 15%, transparent);
}

audio-ui-plot-handle {
  width: calc(var(--spacing, 0.25rem) * 4);
  height: calc(var(--spacing, 0.25rem) * 4);
  border-radius: 9999px;
  background: var(--primary);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 20%, transparent);
  cursor: grab;
}`,
    tailwind: {
      "audio-ui-plot": "block h-44 w-full max-w-lg rounded-md bg-muted",
      "audio-ui-plot-curve": "text-primary/15",
      "audio-ui-plot-grid":
        "text-[10px] text-muted-foreground [&_[data-part=label][data-axis=x]]:bottom-1 [&_[data-part=label][data-axis=x]]:translate-x-1 [&_[data-part=label][data-axis=y]]:left-1 [&_[data-part=label][data-axis=y]]:-translate-y-full [&_[data-part=line]]:stroke-border",
      "audio-ui-plot-handle":
        "size-4 cursor-grab rounded-full bg-primary ring-4 ring-primary/20",
    },
  },
  sequencer: {
    css: `audio-ui-sequencer {
  display: grid;
  gap: calc(var(--spacing, 0.25rem) * 1 * var(--density, 1));
  width: 100%;
  max-width: 36rem;
}

audio-ui-sequencer-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: calc(var(--spacing, 0.25rem) * 1 * var(--density, 1));
}

audio-ui-sequencer-cell {
  aspect-ratio: 1;
  border-radius: calc(var(--radius) - 4px);
  background: var(--muted);
  outline: none;
}

audio-ui-sequencer-cell:focus-visible {
  box-shadow: 0 0 0 2px var(--ring);
}

audio-ui-sequencer-cell[data-on] {
  background: var(--primary);
}`,
    tailwind: {
      "audio-ui-sequencer":
        "grid w-full max-w-xl gap-[calc(var(--spacing)*var(--density,1))]",
      "audio-ui-sequencer-cell":
        "aspect-square rounded-sm bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring data-on:bg-primary",
      "audio-ui-sequencer-row":
        "grid grid-flow-col auto-cols-fr gap-[calc(var(--spacing)*var(--density,1))]",
    },
  },
  timeline: {
    css: `audio-ui-timeline {
  display: block;
  width: 100%;
  max-width: 36rem;
}

audio-ui-timeline-viewport {
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
}

audio-ui-timeline-ruler {
  height: calc(var(--spacing, 0.25rem) * 6);
  margin-inline-start: calc(var(--spacing, 0.25rem) * 20);
  background: var(--muted);
  cursor: pointer;
}

audio-ui-timeline-mark {
  height: 100%;
  padding-inline-start: calc(var(--spacing, 0.25rem) * 1);
  border-inline-start: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 10px;
}

audio-ui-timeline-range {
  top: 0;
  bottom: 0;
  background: color-mix(in oklab, var(--primary) 15%, transparent);
}

audio-ui-timeline-track {
  height: calc(var(--spacing, 0.25rem) * 14);
  border-top: 1px solid var(--border);
}

audio-ui-timeline-track-header {
  width: calc(var(--spacing, 0.25rem) * 20);
  padding: calc(var(--spacing, 0.25rem) * 2);
  border-inline-end: 1px solid var(--border);
  background: var(--background);
  font-size: 0.75rem;
  line-height: 1rem;
}

audio-ui-timeline-clip {
  top: calc(var(--spacing, 0.25rem) * 1);
  bottom: calc(var(--spacing, 0.25rem) * 1);
  overflow: hidden;
  border-radius: calc(var(--radius) - 4px);
  background: color-mix(in oklab, var(--primary) 15%, transparent);
}

audio-ui-timeline-clip[data-selected] {
  box-shadow: 0 0 0 2px var(--ring);
}

audio-ui-timeline-clip-header {
  overflow: hidden;
  padding-inline: calc(var(--spacing, 0.25rem) * 1.5);
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: grab;
}

audio-ui-timeline-clip-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: calc(var(--spacing, 0.25rem) * 1.5);
  cursor: ew-resize;
}

audio-ui-timeline-clip-handle[edge="start"] {
  left: 0;
}

audio-ui-timeline-clip-handle[edge="end"] {
  right: 0;
}

audio-ui-timeline-playhead {
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--foreground);
}

audio-ui-timeline-navigator {
  height: calc(var(--spacing, 0.25rem) * 3);
  margin-top: calc(var(--spacing, 0.25rem) * 2);
  border-radius: calc(var(--radius) - 4px);
  background: var(--muted);
}

audio-ui-timeline-navigator-window {
  top: 0;
  bottom: 0;
  border-radius: calc(var(--radius) - 4px);
  background: color-mix(in oklab, var(--primary) 25%, transparent);
  cursor: grab;
}`,
    tailwind: {
      "audio-ui-timeline": "block w-full max-w-xl",
      "audio-ui-timeline-clip":
        "inset-y-1 overflow-hidden rounded-sm bg-primary/15 data-selected:ring-2 data-selected:ring-ring",
      "audio-ui-timeline-clip-handle":
        "absolute inset-y-0 w-1.5 cursor-ew-resize [&[edge=end]]:right-0 [&[edge=start]]:left-0",
      "audio-ui-timeline-clip-header":
        "cursor-grab truncate bg-primary px-1.5 text-[10px] text-primary-foreground",
      "audio-ui-timeline-mark":
        "h-full border-s ps-1 text-[10px] text-muted-foreground",
      "audio-ui-timeline-navigator": "mt-2 h-3 rounded-sm bg-muted",
      "audio-ui-timeline-navigator-window":
        "inset-y-0 cursor-grab rounded-sm bg-primary/25",
      "audio-ui-timeline-playhead": "inset-y-0 w-px bg-foreground",
      "audio-ui-timeline-range": "inset-y-0 bg-primary/15",
      "audio-ui-timeline-ruler": "ms-20 h-6 cursor-pointer bg-muted",
      "audio-ui-timeline-track": "h-14 border-t",
      "audio-ui-timeline-track-header":
        "w-20 border-e bg-background p-2 text-xs",
      "audio-ui-timeline-viewport": "rounded-md border",
    },
  },
  waveform: {
    css: `audio-ui-waveform {
  display: block;
  width: 100%;
  max-width: 36rem;
}

audio-ui-waveform-control {
  position: relative;
  display: block;
  height: calc(var(--spacing, 0.25rem) * 20);
  border-radius: calc(var(--radius) - 2px);
  background: var(--muted);
  cursor: pointer;
}

audio-ui-waveform-canvas {
  position: absolute;
  inset: 0;
  --waveform-progress-color: var(--primary);
  color: var(--muted-foreground);
}

audio-ui-waveform-region {
  top: 0;
  bottom: 0;
  background: color-mix(in oklab, var(--primary) 10%, transparent);
}

audio-ui-waveform-region-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: calc(var(--spacing, 0.25rem) * 1);
  background: var(--primary);
  cursor: ew-resize;
}

audio-ui-waveform-region-handle[edge="start"] {
  left: 0;
}

audio-ui-waveform-region-handle[edge="end"] {
  right: 0;
}

audio-ui-waveform-playhead {
  top: 0;
  bottom: 0;
  width: calc(var(--spacing, 0.25rem) * 0.5);
  background: var(--foreground);
}

audio-ui-waveform-hover {
  top: calc(var(--spacing, 0.25rem) * -6);
  translate: -50% 0;
  padding-inline: calc(var(--spacing, 0.25rem) * 1);
  border-radius: 0.25rem;
  background: var(--popover);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10px;
  pointer-events: none;
}`,
    tailwind: {
      "audio-ui-waveform": "block w-full max-w-xl",
      "audio-ui-waveform-canvas":
        "absolute inset-0 text-muted-foreground [--waveform-progress-color:var(--primary)]",
      "audio-ui-waveform-control":
        "relative block h-20 cursor-pointer rounded-md bg-muted",
      "audio-ui-waveform-hover":
        "pointer-events-none -top-6 -translate-x-1/2 rounded bg-popover px-1 font-mono text-[10px]",
      "audio-ui-waveform-playhead": "inset-y-0 w-0.5 bg-foreground",
      "audio-ui-waveform-region": "inset-y-0 bg-primary/10",
      "audio-ui-waveform-region-handle":
        "absolute inset-y-0 w-1 cursor-ew-resize bg-primary [&[edge=end]]:right-0 [&[edge=start]]:left-0",
    },
  },
  xypad: {
    css: `audio-ui-xypad {
  display: block;
  width: calc(var(--spacing, 0.25rem) * 48);
}

audio-ui-xypad-control {
  position: relative;
  display: block;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: calc(var(--radius) - 2px);
  background: var(--muted);
  cursor: crosshair;
}

/* The crosshair follows the point. */
audio-ui-xypad-control::before,
audio-ui-xypad-control::after {
  content: "";
  position: absolute;
  background: var(--border);
  pointer-events: none;
}

audio-ui-xypad-control::before {
  top: 0;
  bottom: 0;
  left: var(--xy-pad-x);
  width: 1px;
}

audio-ui-xypad-control::after {
  top: var(--xy-pad-y);
  right: 0;
  left: 0;
  height: 1px;
}

audio-ui-xypad-thumb {
  position: absolute;
  width: calc(var(--spacing, 0.25rem) * 4);
  height: calc(var(--spacing, 0.25rem) * 4);
  border-radius: 9999px;
  background: var(--primary);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 20%, transparent);
}

audio-ui-xypad-value {
  display: block;
  margin-top: calc(var(--spacing, 0.25rem) * 2);
  color: var(--muted-foreground);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.75rem;
  line-height: 1rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}`,
    tailwind: {
      "audio-ui-xypad": "block w-48",
      "audio-ui-xypad-control":
        "relative block aspect-square cursor-crosshair overflow-hidden rounded-md bg-muted before:pointer-events-none before:absolute before:inset-y-0 before:left-(--xy-pad-x) before:w-px before:bg-border before:content-[''] after:pointer-events-none after:absolute after:inset-x-0 after:top-(--xy-pad-y) after:h-px after:bg-border after:content-['']",
      "audio-ui-xypad-thumb":
        "absolute size-4 rounded-full bg-primary ring-4 ring-primary/20",
      "audio-ui-xypad-value":
        "mt-2 block text-center font-mono text-muted-foreground text-xs tabular-nums",
    },
  },
};

/** The theme variables an example's stylesheet reads, from the skins themselves. */
const VARIABLE = /var\(--([a-z-]+)\)/g;
export const SKIN_VARIABLES: readonly string[] = [
  ...new Set(
    Object.values(SKINS).flatMap(({ css }) =>
      [...css.matchAll(VARIABLE)].map((match) => match[1] ?? "")
    )
  ),
]
  .filter((name) => !(name.startsWith("xy-") || name.startsWith("piano-")))
  .sort();
