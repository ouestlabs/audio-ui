import { describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the piano roll in every framework: it writes no markup of its
 * own, only drives the DOM a framework renders from the same `piano-roll.ts`,
 * and finds each part by its `data-slot`.
 */

interface Note {
  id: number | string;
  length: number;
  pitch: number;
  start: number;
  velocity?: number;
}

interface ChangeDetails {
  cancel: () => void;
  reason: string;
  source?: string;
}

const KEBAB = /([a-z0-9])([A-Z])/g;
/** A part as its `data-slot` writes it: `trackHeader` is `track-header`. */
const kebab = (slot: string) => slot.replace(KEBAB, "$1-$2").toLowerCase();

export interface PianoRollOptions {
  [option: string]: unknown;
}

/** What the suite asks a framework to render, besides the roll itself. */
export interface PianoRollTree {
  options: PianoRollOptions & {
    onNoteOn: (pitch: number, details: object) => void;
    onSelectionChange: (
      selection: (number | string)[],
      details: ChangeDetails
    ) => void;
    onValueChange: (value: Note[], details: ChangeDetails) => void;
    onValueCommitted: (value: Note[], details: { reason: string }) => void;
  };
}

/** A roll a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountPianoRoll = (tree: PianoRollTree) => Promise<Mounted>;

const NOTES: Note[] = [
  { id: 1, length: 20, pitch: 61, start: 10 },
  { id: 2, length: 10, pitch: 63, start: 50 },
];

/** Pitches 60 to 63: four rows of 10 px in a 100 by 40 px grid, so a pixel is a unit. */
const BASE = {
  duration: 100,
  maxPitch: 63,
  minPitch: 60,
  snapStep: 1,
};

async function render(mount: MountPianoRoll, options: PianoRollOptions = {}) {
  const changes: [Note[], string][] = [];
  const selections: [(number | string)[], string][] = [];
  const commits: [Note[], string][] = [];
  const noteOns: number[] = [];
  const mounted = await mount({
    options: {
      ...BASE,
      defaultValue: NOTES,
      ...options,
      onNoteOn: (pitch) => {
        noteOns.push(pitch);
      },
      onSelectionChange: (selection, details) => {
        selections.push([[...selection], details.reason]);
      },
      onValueChange: (value, details) => {
        changes.push([value.map((note) => ({ ...note })), details.reason]);
      },
      onValueCommitted: (value, details) => {
        commits.push([value.map((note) => ({ ...note })), details.reason]);
      },
    },
  });
  const one = (slot: string) =>
    mounted.container.querySelector(
      `[data-slot="piano-roll-${kebab(slot)}"]`
    ) as HTMLElement;
  const all = (slot: string) => [
    ...mounted.container.querySelectorAll<HTMLElement>(
      `[data-slot="piano-roll-${kebab(slot)}"]`
    ),
  ];
  const root = mounted.container.querySelector(
    '[data-slot="piano-roll"]'
  ) as HTMLElement;
  const grid = one("grid");
  mockRect(grid, { bottom: 40, height: 40, right: 100, width: 100 });
  const lane = one("velocityLane");
  if (lane) {
    mockRect(lane, { bottom: 40, height: 40, right: 100, width: 100 });
  }
  return {
    ...mounted,
    all,
    changes,
    commits,
    grid,
    lane,
    noteOns,
    notes: () => all("note"),
    one,
    root,
    selections,
  };
}

const styleOf = (element: HTMLElement | undefined) =>
  element?.getAttribute("style") ?? "";

/** Waits for the frame a drag reports its moves on. */
const frame = () => new Promise((resolve) => setTimeout(resolve, 30));

export function pianoRollSuite(framework: string, mount: MountPianoRoll) {
  describe(`the piano roll in ${framework}`, () => {
    test("the roll counts its rows, and a row for each pitch says what it is", async () => {
      const p = await render(mount, { mode: "draw", scale: undefined });
      expect(styleOf(p.root)).toContain("--piano-roll-rows: 4");
      expect(p.root.getAttribute("data-mode")).toBe("draw");
      const rows = p.all("row");
      expect(rows).toHaveLength(4);
      expect(rows.map((row) => row.getAttribute("data-pitch"))).toEqual([
        "63",
        "62",
        "61",
        "60",
      ]);
      expect(rows[2]?.getAttribute("data-color")).toBe("black");
      expect(rows[1]?.getAttribute("data-color")).toBe("white");
      expect(rows[3]?.hasAttribute("data-octave")).toBe(true);
      p.unmount();
    });

    test("a note is placed by its start, length and pitch, and named for assistive technology", async () => {
      const p = await render(mount);
      const [first] = p.notes();
      expect(styleOf(first)).toContain("--timeline-offset: 10");
      expect(styleOf(first)).toContain("--timeline-length: 20");
      expect(styleOf(first)).toContain("--piano-roll-row: 2");
      expect(first?.getAttribute("aria-label")).toBe("C#4, 10 to 30");
      expect(first?.getAttribute("aria-pressed")).toBe("false");
      expect(first?.getAttribute("role")).toBe("button");
      expect(p.notes()).toHaveLength(2);
      p.unmount();
    });

    test("a press on a note selects it, and the roll knows something is selected", async () => {
      const p = await render(mount);
      const [first] = p.notes();
      await p.act(() => {
        pointer(first as HTMLElement, "pointerdown", {
          clientX: 15,
          clientY: 25,
          pointerId: 1,
        });
      });
      expect(p.selections.at(-1)?.[0]).toEqual([1]);
      expect(first?.getAttribute("aria-pressed")).toBe("true");
      expect(first?.hasAttribute("data-selected")).toBe(true);
      expect(p.root.hasAttribute("data-has-selection")).toBe(true);
      await p.act(() => {
        pointer(first as HTMLElement, "pointerup", {
          clientX: 15,
          clientY: 25,
          pointerId: 1,
        });
      });
      p.unmount();
    });

    test("dragging a note moves it on the grid, and the end commits", async () => {
      const p = await render(mount);
      const [first] = p.notes();
      await p.act(() => {
        pointer(first as HTMLElement, "pointerdown", {
          clientX: 15,
          clientY: 25,
          pointerId: 1,
        });
        pointer(first as HTMLElement, "pointermove", {
          clientX: 35,
          clientY: 25,
          pointerId: 1,
        });
      });
      await frame();
      await p.act(() => undefined);
      expect(p.changes.at(-1)?.[0][0]?.start).toBe(30);
      expect(p.changes.at(-1)?.[1]).toBe("drag");
      expect(styleOf(p.notes()[0])).toContain("--timeline-offset: 30");
      await p.act(() => {
        pointer(first as HTMLElement, "pointerup", {
          clientX: 35,
          clientY: 25,
          pointerId: 1,
        });
      });
      expect(p.commits.at(-1)?.[0][0]?.start).toBe(30);
      p.unmount();
    });

    test("a note's handles resize it from its edges", async () => {
      const p = await render(mount);
      const handle = p
        .notes()[0]
        ?.querySelector('[data-slot="piano-roll-note-end"]') as HTMLElement;
      expect(handle.getAttribute("data-edge")).toBe("end");
      await p.act(() => {
        pointer(handle, "pointerdown", {
          clientX: 30,
          clientY: 25,
          pointerId: 1,
        });
        pointer(handle, "pointermove", {
          clientX: 40,
          clientY: 25,
          pointerId: 1,
        });
        pointer(handle, "pointerup", {
          clientX: 40,
          clientY: 25,
          pointerId: 1,
        });
      });
      expect(p.changes.at(-1)?.[0][0]?.length).toBe(30);
      p.unmount();
    });

    test("in draw mode a press on the grid draws a note", async () => {
      const p = await render(mount, { mode: "draw" });
      await p.act(() => {
        pointer(p.grid, "pointerdown", {
          clientX: 70,
          clientY: 5,
          pointerId: 1,
        });
        pointer(p.grid, "pointermove", {
          clientX: 80,
          clientY: 5,
          pointerId: 1,
        });
        pointer(p.grid, "pointerup", { clientX: 80, clientY: 5, pointerId: 1 });
      });
      const last = p.changes.at(-1)?.[0] ?? [];
      expect(last).toHaveLength(3);
      expect(last.at(-1)?.pitch).toBe(63);
      expect(last.at(-1)?.start).toBe(70);
      expect(p.notes()).toHaveLength(3);
      p.unmount();
    });

    test("a paint stroke quicker than a frame paints a note in every cell it crosses", async () => {
      const p = await render(mount, { drawStyle: "paint", mode: "draw" });
      await p.act(() => {
        pointer(p.grid, "pointerdown", {
          clientX: 70,
          clientY: 5,
          pointerId: 1,
        });
        // One move across ten cells of one unit, one pixel each.
        pointer(p.grid, "pointermove", {
          clientX: 80,
          clientY: 5,
          pointerId: 1,
        });
      });
      await frame();
      await p.act(() => undefined);
      const starts = (p.changes.at(-1)?.[0] ?? [])
        .filter((note) => note.pitch === 63 && note.start >= 70)
        .map((note) => note.start)
        .sort((a, b) => a - b);
      expect(starts).toEqual([70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80]);
      p.unmount();
    });

    test("Delete on a note removes it", async () => {
      const p = await render(mount);
      const [first] = p.notes();
      await p.act(() => key(first as HTMLElement, "Delete"));
      expect(p.changes.at(-1)?.[0]).toHaveLength(1);
      expect(p.notes()).toHaveLength(1);
      p.unmount();
    });

    test("a drag across the bare grid in select mode draws a marquee and selects what it covers", async () => {
      const p = await render(mount);
      const marquee = p.one("marquee");
      expect(marquee.hasAttribute("hidden")).toBe(true);
      await p.act(() => {
        pointer(p.grid, "pointerdown", {
          clientX: 5,
          clientY: 5,
          pointerId: 1,
        });
        pointer(p.grid, "pointermove", {
          clientX: 35,
          clientY: 35,
          pointerId: 1,
        });
      });
      await frame();
      await p.act(() => undefined);
      expect(marquee.hasAttribute("hidden")).toBe(false);
      expect(styleOf(marquee)).toContain("width: 30px");
      await p.act(() => {
        pointer(p.grid, "pointerup", {
          clientX: 35,
          clientY: 35,
          pointerId: 1,
        });
      });
      expect(p.selections.at(-1)?.[0]).toEqual([1]);
      expect(marquee.hasAttribute("hidden")).toBe(true);
      p.unmount();
    });

    test("the selection's span follows the notes selected", async () => {
      const p = await render(mount, { defaultSelection: [1, 2] });
      const span = p.one("selectionSpan");
      expect(span.hasAttribute("hidden")).toBe(false);
      expect(styleOf(span)).toContain("--timeline-offset: 10");
      expect(styleOf(span)).toContain("--timeline-length: 50");
      p.unmount();
    });

    test("a velocity bar under each note reads its velocity, and its input sets it", async () => {
      const p = await render(mount, {
        defaultValue: [{ ...NOTES[0], velocity: 0.5 }, NOTES[1]],
      });
      const bars = p.all("velocity");
      expect(bars).toHaveLength(2);
      expect(styleOf(bars[0])).toContain("--piano-roll-level: 0.5");
      const input = bars[0]?.querySelector("input") as HTMLInputElement;
      expect(input.getAttribute("aria-valuetext")).toBe("50%");
      await p.act(() => key(input, "ArrowUp"));
      expect(p.changes.at(-1)?.[0][0]?.velocity).toBeGreaterThan(0.5);
      p.unmount();
    });

    test("a live position drives the Enter shortcut: it adds a note where the playhead is", async () => {
      const source = createSource(40);
      const p = await render(mount, { source });
      await p.act(() => key(p.grid, "Enter"));
      const last = p.changes.at(-1)?.[0] ?? [];
      expect(last.some((note) => note.start === 40)).toBe(true);
      p.unmount();
    });

    test("a disabled roll takes no gesture", async () => {
      const p = await render(mount, { disabled: true });
      const [first] = p.notes();
      await p.act(() => {
        pointer(first as HTMLElement, "pointerdown", {
          clientX: 15,
          clientY: 25,
          pointerId: 1,
        });
      });
      expect(p.selections).toHaveLength(0);
      expect(p.root.hasAttribute("data-disabled")).toBe(true);
      p.unmount();
    });
  });
}
