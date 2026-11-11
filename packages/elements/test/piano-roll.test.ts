import { describe, expect, test } from "bun:test";
import "../src/piano-roll/index.ts";
import type { PianoRollElement } from "../src/piano-roll/index.ts";
import { key, mockRect, pointer } from "./helpers.ts";

type Note = {
  id: string;
  length: number;
  pitch: number;
  start: number;
  velocity?: number;
};

/** C4 (60) to D#4 (63): four rows, the top one D#4. */
const NOTES: Note[] = [
  { id: "a", length: 2, pitch: 60, start: 0, velocity: 1 },
  { id: "b", length: 4, pitch: 62, start: 4, velocity: 0.5 },
];

/** A roll on a 16-unit timeline with a grid every unit, its grid 160×40 at the origin: 10px per unit across, 10px per row down. */
function renderRoll(attributes = "") {
  document.body.innerHTML = `
    <audio-ui-timeline duration="16" snap-step="1">
      <audio-ui-piano-roll max-pitch="63" min-pitch="60" ${attributes}>
        <audio-ui-piano-roll-keys>
          <audio-ui-piano aria-label="Keys"><audio-ui-piano-keys></audio-ui-piano-keys></audio-ui-piano>
        </audio-ui-piano-roll-keys>
        <audio-ui-piano-roll-grid aria-label="Notes">
          <audio-ui-piano-roll-rows></audio-ui-piano-roll-rows>
          <audio-ui-piano-roll-notes>
            <template><audio-ui-piano-roll-note-handle edge="end"></audio-ui-piano-roll-note-handle></template>
          </audio-ui-piano-roll-notes>
          <audio-ui-piano-roll-marquee></audio-ui-piano-roll-marquee>
        </audio-ui-piano-roll-grid>
        <audio-ui-piano-roll-velocity-lane aria-label="Velocity">
          <audio-ui-piano-roll-velocities></audio-ui-piano-roll-velocities>
        </audio-ui-piano-roll-velocity-lane>
      </audio-ui-piano-roll>
    </audio-ui-timeline>`;
  const roll = document.querySelector(
    "audio-ui-piano-roll"
  ) as PianoRollElement;
  roll.value = NOTES;
  const grid = roll.querySelector("audio-ui-piano-roll-grid") as HTMLElement;
  mockRect(grid, { bottom: 40, height: 40, right: 160, width: 160 });
  const lane = roll.querySelector(
    "audio-ui-piano-roll-velocity-lane"
  ) as HTMLElement;
  mockRect(lane, { bottom: 140, height: 40, right: 160, top: 100, width: 160 });
  const changes: [Note[], string][] = [];
  const commits: [Note[], string][] = [];
  roll.addEventListener("input", (event) => {
    const { reason, value } = event.detail;
    changes.push([value as Note[], reason]);
  });
  roll.addEventListener("change", (event) => {
    const { reason, value } = event.detail;
    commits.push([value as Note[], reason]);
  });
  return {
    changes,
    commits,
    grid,
    note: (id: string) =>
      roll.querySelector(
        `audio-ui-piano-roll-note[note-id="${id}"]`
      ) as HTMLElement,
    notes: () => [...roll.querySelectorAll("audio-ui-piano-roll-note")],
    roll,
  };
}

const settle = () => Promise.resolve();

describe("the piano roll's rows and notes", () => {
  test("makes a row per pitch, highest first, and says how many there are", () => {
    const { roll } = renderRoll();
    const rows = [...roll.querySelectorAll("audio-ui-piano-roll-row")];
    expect(rows.map((row) => row.getAttribute("pitch"))).toEqual([
      "63",
      "62",
      "61",
      "60",
    ]);
    expect(rows[0]?.getAttribute("data-color")).toBe("black");
    expect(rows[3]?.hasAttribute("data-octave")).toBe(true);
    // With no scale, no row is out of one.
    expect(rows.some((row) => row.hasAttribute("data-out-of-scale"))).toBe(
      false
    );
    expect(roll.style.getPropertyValue("--piano-roll-rows")).toBe("4");
  });

  test("marks the rows of its scale, and the root's apart", () => {
    const { roll } = renderRoll('scale="major" scale-root="2"');
    const row = (pitch: number) =>
      roll.querySelector(`audio-ui-piano-roll-row[pitch="${pitch}"]`);
    expect(row(62)?.hasAttribute("data-in-scale")).toBe(true);
    expect(row(62)?.hasAttribute("data-scale-root")).toBe(true);
    expect(row(61)?.hasAttribute("data-in-scale")).toBe(true);
    expect(row(61)?.hasAttribute("data-scale-root")).toBe(false);
    expect(row(60)?.hasAttribute("data-in-scale")).toBe(false);
    expect(row(60)?.hasAttribute("data-out-of-scale")).toBe(true);
    expect(row(61)?.hasAttribute("data-out-of-scale")).toBe(false);
  });

  test("makes a named toggle button per note, placed at its start and on its row", async () => {
    const { note, notes } = renderRoll();
    await settle();
    expect(notes()).toHaveLength(2);
    const a = note("a");
    expect(a.getAttribute("role")).toBe("button");
    expect(a.getAttribute("aria-label")).toBe("C4, 0 to 2");
    expect(a.getAttribute("aria-pressed")).toBe("false");
    expect(a.style.getPropertyValue("--timeline-offset")).toBe("0");
    expect(a.style.getPropertyValue("--timeline-length")).toBe("2");
    expect(a.style.getPropertyValue("--piano-roll-row")).toBe("3");
    expect(note("b").style.getPropertyValue("--piano-roll-velocity")).toBe(
      "0.5"
    );
    expect(a.querySelector("audio-ui-piano-roll-note-handle")).not.toBeNull();
  });

  test("dragging a note moves it on the grid, and a press selects it", () => {
    const { changes, commits, note, roll } = renderRoll();
    const selections: unknown[] = [];
    roll.addEventListener("noteselect", (event) =>
      selections.push((event as CustomEvent).detail.selection)
    );
    pointer(note("a"), "pointerdown", {
      clientX: 5,
      clientY: 35,
      pointerId: 1,
    });
    pointer(note("a"), "pointermove", {
      clientX: 25,
      clientY: 25,
      pointerId: 1,
    });
    pointer(note("a"), "pointerup", { clientX: 25, clientY: 25, pointerId: 1 });
    const moved = changes.at(-1)?.[0].find((each) => each.id === "a");
    expect(moved).toMatchObject({ pitch: 61, start: 2 });
    expect(commits.at(-1)?.[1]).toBe("drag");
    expect(selections.at(-1)).toEqual(["a"]);
    expect(note("a").hasAttribute("data-selected")).toBe(true);
    expect(note("a").getAttribute("aria-pressed")).toBe("true");
    expect(roll.hasAttribute("data-has-selection")).toBe(true);
    expect(note("a").style.getPropertyValue("--piano-roll-row")).toBe("2");
  });

  test("in draw mode a press on empty grid draws a note there, which takes the focus", async () => {
    const { grid, note, notes } = renderRoll('mode="draw"');
    pointer(grid, "pointerdown", { clientX: 105, clientY: 5, pointerId: 1 });
    pointer(grid, "pointerup", { clientX: 105, clientY: 5, pointerId: 1 });
    await settle();
    expect(notes()).toHaveLength(3);
    const drawn = notes().find(
      (each) => !["a", "b"].includes(each.getAttribute("note-id") ?? "")
    ) as HTMLElement;
    expect(drawn.getAttribute("aria-label")).toBe("D#4, 10 to 11");
    expect(note("a")).toBeDefined();
  });

  test("Enter on the grid adds a note at the playback position and focuses it; Delete hands the focus on", async () => {
    const { grid, note, notes, roll } = renderRoll();
    roll.closest("audio-ui-timeline")?.setAttribute("position", "9.5");
    grid.focus();
    key(grid, "Enter");
    await settle();
    expect(notes()).toHaveLength(3);
    const added = document.activeElement as HTMLElement;
    expect(added.localName).toBe("audio-ui-piano-roll-note");
    expect(added.getAttribute("aria-label")).toBe("C#4, 9 to 10");
    note("a").focus();
    key(note("a"), "Delete");
    await settle();
    expect(document.activeElement).toBe(note("b"));
  });

  test("the arrow keys move a focused note, and Delete removes it", async () => {
    const { changes, note, notes } = renderRoll();
    await settle();
    key(note("a"), "ArrowUp");
    expect(changes.at(-1)?.[0].find((each) => each.id === "a")?.pitch).toBe(61);
    key(note("a"), "Delete");
    await settle();
    expect(notes()).toHaveLength(1);
  });

  test("a drag across empty grid selects the notes it covers", () => {
    const { grid, roll } = renderRoll();
    const marquee = roll.querySelector(
      "audio-ui-piano-roll-marquee"
    ) as HTMLElement;
    expect(marquee.style.display).toBe("none");
    pointer(grid, "pointerdown", { clientX: 30, clientY: 5, pointerId: 1 });
    pointer(grid, "pointermove", { clientX: 90, clientY: 25, pointerId: 1 });
    expect(marquee.style.display).toBe("");
    pointer(grid, "pointerup", { clientX: 90, clientY: 25, pointerId: 1 });
    expect(roll.selection).toEqual(["b"]);
  });
});

describe("the piano roll's note ids", () => {
  test("a note with a number for its id is drawn as well", async () => {
    const { notes, roll } = renderRoll();
    roll.value = [{ id: 7, length: 1, pitch: 61, start: 3 }] as never;
    await settle();
    expect(notes()).toHaveLength(1);
    expect(notes()[0]?.getAttribute("aria-label")).toBe("C#4, 3 to 4");
  });
});

describe("the piano roll's velocities", () => {
  test("makes a bar per note at its level, with a named input that takes the keys", async () => {
    const { changes, roll } = renderRoll();
    await settle();
    const bars = [...roll.querySelectorAll("audio-ui-piano-roll-velocity")];
    expect(bars).toHaveLength(2);
    const bar = bars.find(
      (each) => each.getAttribute("note-id") === "b"
    ) as HTMLElement;
    expect(bar.style.getPropertyValue("--piano-roll-level")).toBe("0.5");
    expect(bar.style.getPropertyValue("--timeline-offset")).toBe("4");
    const input = bar.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("D4, 4 to 8");
    expect(input.getAttribute("aria-valuetext")).toBe("50%");
    key(input, "ArrowUp");
    expect(
      changes.at(-1)?.[0].find((each) => each.id === "b")?.velocity
    ).toBeGreaterThan(0.5);
  });
});

describe("the piano roll's keys", () => {
  test("lay the piano inside on the roll's rows, and sound through the roll", async () => {
    const { roll } = renderRoll();
    await settle();
    const piano = roll.querySelector("audio-ui-piano") as HTMLElement & {
      pitches: readonly number[];
    };
    expect(piano.getAttribute("orientation")).toBe("vertical");
    expect(piano.getAttribute("layout")).toBe("even");
    expect([...piano.pitches]).toEqual([63, 62, 61, 60]);
    const sounded: number[] = [];
    roll.addEventListener("noteon", (event) =>
      sounded.push((event as CustomEvent).detail.pitch)
    );
    const pianoKey = roll.querySelector(
      'audio-ui-piano-key[pitch="62"]'
    ) as HTMLElement;
    key(pianoKey, "Enter");
    expect(sounded).toEqual([62]);
  });

  test("Shift on a key selects the notes on its row instead of sounding it", async () => {
    const { roll } = renderRoll();
    await settle();
    const sounded: number[] = [];
    roll.addEventListener("noteon", (event) =>
      sounded.push((event as CustomEvent).detail.pitch)
    );
    const pianoKey = roll.querySelector(
      'audio-ui-piano-key[pitch="62"]'
    ) as HTMLElement;
    key(pianoKey, "Enter", { shiftKey: true });
    expect(sounded).toEqual([]);
    expect(roll.selection).toEqual(["b"]);
  });
});
