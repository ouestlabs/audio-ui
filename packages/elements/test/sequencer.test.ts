import { describe, expect, test } from "bun:test";
import "../src/sequencer/index.ts";
import type { SequencerElement } from "../src/sequencer/index.ts";
import { key, mockRect, pointer } from "./helpers.ts";

/** Two rows of four steps. Cells are 10 px square at (10 × step, 10 × row); velocity bars 10 wide and 100 tall at (10 × step, 100 × row). */
async function renderSequencer(attributes = "", part = "cell") {
  document.body.innerHTML = `
    <audio-ui-sequencer aria-label="Pattern" default-value="x... ..x." ${attributes}>
      <audio-ui-sequencer-rows labels="Row 1, Row 2">
        <template>
          <audio-ui-sequencer-steps>
            <template><audio-ui-sequencer-${part}></audio-ui-sequencer-${part}></template>
          </audio-ui-sequencer-steps>
        </template>
      </audio-ui-sequencer-rows>
    </audio-ui-sequencer>`;
  // The rows and the steps take their templates once the markup is in.
  await new Promise((resolve) => setTimeout(resolve));
  const root = document.querySelector("audio-ui-sequencer") as SequencerElement;
  const rows = [...root.querySelectorAll("audio-ui-sequencer-row")];
  const at = (row: number, step: number) =>
    rows[row]?.querySelectorAll<HTMLElement>(`audio-ui-sequencer-${part}`)[
      step
    ] as HTMLElement;
  for (let row = 0; row < 2; row += 1) {
    for (let step = 0; step < 4; step += 1) {
      const height = part === "cell" ? 10 : 100;
      mockRect(at(row, step), {
        bottom: row * height + height,
        height,
        left: step * 10,
        right: step * 10 + 10,
        top: row * height,
        width: 10,
      });
    }
  }
  const changes: [boolean[][], string][] = [];
  const commits: [boolean[][], string][] = [];
  const velocityChanges: [number[][], string][] = [];
  const velocityCommits: [number[][], string][] = [];
  root.addEventListener("input", (event) =>
    changes.push([event.detail.value, event.detail.reason])
  );
  root.addEventListener("change", (event) =>
    commits.push([event.detail.value, event.detail.reason])
  );
  root.addEventListener("velocityinput", (event) =>
    velocityChanges.push([event.detail.velocities, event.detail.reason])
  );
  root.addEventListener("velocitychange", (event) =>
    velocityCommits.push([event.detail.velocities, event.detail.reason])
  );
  return { at, changes, commits, root, rows, velocityChanges, velocityCommits };
}

const press = (target: Element, clientX: number, clientY: number) =>
  pointer(target, "pointerdown", { clientX, clientY, pointerId: 1 });

describe("the sequencer", () => {
  test("is a group of named rows of toggle buttons, named after their row and step", async () => {
    const { at, root, rows } = await renderSequencer();
    expect(root.getAttribute("role")).toBe("group");
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Row 1",
      "Row 2",
    ]);
    expect(rows.every((row) => row.getAttribute("role") === "group")).toBe(
      true
    );
    expect(at(0, 0).getAttribute("role")).toBe("button");
    expect(at(0, 0).getAttribute("aria-pressed")).toBe("true");
    expect(at(0, 1).getAttribute("aria-pressed")).toBe("false");
    expect(at(0, 0).getAttribute("aria-label")).toBe("Row 1, step 1");
  });

  test("has one tab stop, on the first cell", async () => {
    const { root } = await renderSequencer();
    const stops = [
      ...root.querySelectorAll<HTMLElement>("audio-ui-sequencer-cell"),
    ].filter((cell) => cell.tabIndex === 0);
    expect(stops.map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "Row 1, step 1",
    ]);
  });

  test("a press flips a cell; the release commits it as a paint", async () => {
    const { at, changes, commits } = await renderSequencer();
    press(at(0, 1), 12, 3);
    pointer(at(0, 1), "pointerup", { clientX: 12, clientY: 3, pointerId: 1 });
    expect(changes.at(-1)?.[0][0]).toEqual([true, true, false, false]);
    expect(changes.at(-1)?.[1]).toBe("press");
    expect(commits.at(-1)?.[1]).toBe("paint");
    expect(at(0, 1).getAttribute("aria-pressed")).toBe("true");
    expect(at(0, 1).hasAttribute("data-on")).toBe(true);
  });

  test("paints the new state across the cells the pointer crosses, off when it began on", async () => {
    const on = await renderSequencer();
    press(on.at(0, 1), 12, 3);
    pointer(on.root, "pointermove", { clientX: 22, clientY: 3, pointerId: 1 });
    pointer(on.root, "pointermove", { clientX: 32, clientY: 3, pointerId: 1 });
    pointer(on.root, "pointerup", { clientX: 32, clientY: 3, pointerId: 1 });
    expect(on.changes.at(-1)).toEqual([
      [
        [true, true, true, true],
        [false, false, true, false],
      ],
      "paint",
    ]);
    const off = await renderSequencer();
    press(off.at(1, 2), 22, 13);
    pointer(off.root, "pointermove", { clientX: 12, clientY: 3, pointerId: 1 });
    pointer(off.root, "pointermove", { clientX: 2, clientY: 3, pointerId: 1 });
    pointer(off.root, "pointerup", { clientX: 2, clientY: 3, pointerId: 1 });
    expect(off.changes.at(-1)?.[0]).toEqual([
      [false, false, false, false],
      [false, false, false, false],
    ]);
  });

  test("a canceled input event leaves the pattern as it was", async () => {
    const { at, root } = await renderSequencer();
    root.addEventListener("input", (event) => event.preventDefault());
    press(at(0, 1), 12, 3);
    expect(at(0, 1).getAttribute("aria-pressed")).toBe("false");
  });

  test("Space or Enter flips the focused cell; the arrows move between cells with one tab stop", async () => {
    const { at, commits } = await renderSequencer();
    key(at(0, 0), " ");
    expect(at(0, 0).getAttribute("aria-pressed")).toBe("false");
    expect(commits.at(-1)?.[1]).toBe("keyboard");
    key(at(0, 0), "Enter");
    expect(at(0, 0).getAttribute("aria-pressed")).toBe("true");
    key(at(0, 0), "ArrowRight");
    expect(document.activeElement).toBe(at(0, 1));
    expect(at(0, 1).tabIndex).toBe(0);
    expect(at(0, 0).tabIndex).toBe(-1);
    key(at(0, 1), "ArrowDown");
    expect(document.activeElement).toBe(at(1, 1));
    key(at(1, 1), "End");
    expect(document.activeElement).toBe(at(1, 3));
  });

  test("does nothing when disabled", async () => {
    const { at, changes } = await renderSequencer("disabled");
    press(at(0, 1), 12, 3);
    key(at(0, 0), " ");
    expect(changes).toEqual([]);
    expect(at(0, 0).getAttribute("aria-disabled")).toBe("true");
  });

  test("follows a pattern set from outside, and a source of the step being played", async () => {
    const { at, root } = await renderSequencer('value=".x.. ...."');
    expect(at(0, 1).getAttribute("aria-pressed")).toBe("true");
    root.value = [
      [false, false, false, true],
      [false, false, false, false],
    ];
    expect(at(0, 3).getAttribute("aria-pressed")).toBe("true");
    let step = 1;
    const listeners = new Set<() => void>();
    root.source = {
      getSnapshot: () => step,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    expect(at(0, 1).hasAttribute("data-current")).toBe(true);
    expect(at(1, 1).hasAttribute("data-current")).toBe(true);
    expect(at(0, 0).hasAttribute("data-current")).toBe(false);
    step = 2;
    for (const listener of listeners) {
      listener();
    }
    expect(at(0, 1).hasAttribute("data-current")).toBe(false);
    expect(at(1, 2).hasAttribute("data-current")).toBe(true);
    step = -1;
    for (const listener of listeners) {
      listener();
    }
    expect(at(1, 2).hasAttribute("data-current")).toBe(false);
  });
});

describe("a velocity bar", () => {
  test("stands at full until it is set, as a range input and a CSS variable", async () => {
    const { at } = await renderSequencer("", "velocity");
    const input = at(0, 1).querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("1");
    expect(at(0, 1).style.getPropertyValue("--sequencer-velocity")).toBe("1");
    expect(input.getAttribute("aria-valuetext")).toBe("100%");
    expect(input.getAttribute("aria-label")).toBe("Step 2");
  });

  test("a press sets the velocity where the pointer is, and a drag draws the steps of its row only", async () => {
    const { at, velocityChanges, velocityCommits } = await renderSequencer(
      "",
      "velocity"
    );
    pointer(at(0, 1), "pointerdown", {
      clientX: 15,
      clientY: 75,
      pointerId: 1,
    });
    expect(velocityChanges.at(-1)).toEqual([
      [
        [1, 0.25, 1, 1],
        [1, 1, 1, 1],
      ],
      "drag",
    ]);
    pointer(at(0, 1), "pointerup", { pointerId: 1 });
    expect(velocityCommits.at(-1)?.[1]).toBe("drag");
    expect(at(0, 1).style.getPropertyValue("--sequencer-velocity")).toBe(
      "0.25"
    );
    pointer(at(0, 0), "pointerdown", { clientX: 5, clientY: 50, pointerId: 2 });
    pointer(at(0, 0), "pointermove", {
      buttons: 1,
      clientX: 25,
      clientY: 20,
      pointerId: 2,
    });
    pointer(at(0, 0), "pointermove", {
      buttons: 1,
      clientX: 35,
      clientY: 180,
      pointerId: 2,
    });
    pointer(at(0, 0), "pointerup", { pointerId: 2 });
    const [velocities] = velocityChanges.at(-1) ?? [[]];
    expect(velocities[0]).toEqual([0.5, 0.25, 0.8, 0]);
    expect(velocities[1]).toEqual([1, 1, 1, 1]);
  });

  test("steps with the arrows, further with Page Up and Down, to the ends with Home and End; Delete back to full", async () => {
    const { at, velocityChanges } = await renderSequencer("", "velocity");
    const input = at(0, 0).querySelector("input") as HTMLInputElement;
    key(input, "ArrowDown");
    expect(velocityChanges.at(-1)?.[0][0]?.[0]).toBeCloseTo(0.95);
    expect(velocityChanges.at(-1)?.[1]).toBe("keyboard");
    key(input, "PageDown");
    expect(velocityChanges.at(-1)?.[0][0]?.[0]).toBeCloseTo(0.7);
    key(input, "Home");
    expect(velocityChanges.at(-1)?.[0][0]?.[0]).toBe(0);
    key(input, "Delete");
    expect(velocityChanges.at(-1)).toEqual([
      [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
      "reset",
    ]);
  });

  test("a canceled velocityinput keeps the velocity, and the pattern is left alone", async () => {
    const { at, changes, root } = await renderSequencer("", "velocity");
    root.addEventListener("velocityinput", (event) => event.preventDefault());
    const input = at(0, 0).querySelector("input") as HTMLInputElement;
    key(input, "ArrowDown");
    expect(input.value).toBe("1");
    expect(changes).toEqual([]);
  });
});
