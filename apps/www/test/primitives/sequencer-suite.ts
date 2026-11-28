import { describe, expect, test } from "bun:test";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the sequencer in every framework: it writes no markup of its
 * own, only drives the DOM a framework renders from the same `sequencer.ts`,
 * and finds each part by its `data-slot`.
 */

export type Pattern = boolean[][];

interface ChangeDetails {
  cancel: () => void;
  reason: string;
  source?: string;
}

export interface SequencerOptions {
  onValueChange?: (value: Pattern, details: ChangeDetails) => void;
  [option: string]: unknown;
}

/** What the suite asks a framework to render. */
export interface SequencerTree {
  options: SequencerOptions & {
    onValueCommitted: (value: Pattern, details: { reason: string }) => void;
    onValueChange: (value: Pattern, details: ChangeDetails) => void;
  };
  /** Whether each step has a velocity bar. */
  velocityBars?: boolean;
}

/** A sequencer a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountSequencer = (tree: SequencerTree) => Promise<Mounted>;

const PATTERN: Pattern = [
  [true, false, false, false],
  [false, false, true, false],
];

async function render(
  mount: MountSequencer,
  options: SequencerOptions = {},
  extra: Pick<SequencerTree, "velocityBars"> = {}
) {
  const changes: [Pattern, string][] = [];
  const commits: [Pattern, string][] = [];
  const mounted = await mount({
    options: {
      defaultValue: PATTERN,
      ...options,
      onValueChange: (value, details) => {
        changes.push([value.map((row) => [...row]), details.reason]);
        options.onValueChange?.(value, details);
      },
      onValueCommitted: (value, details) => {
        commits.push([value.map((row) => [...row]), details.reason]);
      },
    },
    ...extra,
  });
  const all = (slot: string) => [
    ...mounted.container.querySelectorAll<HTMLElement>(
      `[data-slot="sequencer-${slot}"]`
    ),
  ];
  const root = mounted.container.querySelector(
    '[data-slot="sequencer"]'
  ) as HTMLElement;
  // A 400×100 grid at the origin: 4 steps of 100 px, two rows of 50 px each.
  mockRect(root, { bottom: 100, height: 100, right: 400, width: 400 });
  // Each cell is 100 px wide, and each row 50 px tall, so a drag reads the cell it is over.
  for (const cell of all("cell")) {
    const row = Number(cell.getAttribute("data-row"));
    const step = Number(cell.getAttribute("data-step"));
    mockRect(cell, {
      bottom: 50 * (row + 1),
      height: 50,
      left: 100 * step,
      right: 100 * (step + 1),
      top: 50 * row,
      width: 100,
    });
  }
  return {
    ...mounted,
    changes,
    commits,
    cell: (row: number, step: number) =>
      all("cell").find(
        (each) =>
          each.getAttribute("data-row") === String(row) &&
          each.getAttribute("data-step") === String(step)
      ) as HTMLElement,
    cells: () => all("cell"),
    root,
    rows: () => all("row"),
    velocities: () => all("velocity"),
  };
}

const styleOf = (element: HTMLElement | undefined) =>
  element?.getAttribute("style") ?? "";

/** Waits for the frame a drag reports its moves on. */
const frame = () => new Promise((resolve) => setTimeout(resolve, 30));

export function sequencerSuite(framework: string, mount: MountSequencer) {
  describe(`the sequencer in ${framework}`, () => {
    test("a group of rows, each with a button per step", async () => {
      const s = await render(mount);
      expect(s.root.getAttribute("role")).toBe("group");
      expect(s.rows()).toHaveLength(2);
      expect(s.cells()).toHaveLength(8);
      expect(s.cells().every((cell) => cell.tagName === "BUTTON")).toBe(true);
      s.unmount();
    });

    test("a cell is pressed when its step is on", async () => {
      const s = await render(mount);
      expect(s.cell(0, 0).getAttribute("aria-pressed")).toBe("true");
      expect(s.cell(0, 1).getAttribute("aria-pressed")).toBe("false");
      expect(s.cell(1, 2).hasAttribute("data-on")).toBe(true);
      s.unmount();
    });

    test("a press flips the step and paints across the cells it crosses", async () => {
      const s = await render(mount);
      await s.act(() =>
        pointer(s.cell(0, 1), "pointerdown", {
          clientX: 150,
          clientY: 25,
          pointerId: 1,
        })
      );
      expect(s.changes.at(-1)?.[0][0]).toEqual([true, true, false, false]);
      expect(s.cell(0, 1).getAttribute("aria-pressed")).toBe("true");
      // A pointer reports each cell it crosses on its way.
      const cross = async (clientX: number) => {
        await s.act(() =>
          pointer(s.cell(0, 1), "pointermove", {
            clientX,
            clientY: 25,
            pointerId: 1,
          })
        );
        await frame();
        await s.act(() => undefined);
      };
      await cross(250);
      await cross(350);
      // The drag carries the new state across the cells it crosses.
      expect(s.changes.at(-1)?.[0][0]).toEqual([true, true, true, true]);
      await s.act(() =>
        pointer(s.cell(0, 1), "pointerup", {
          clientX: 350,
          clientY: 25,
          pointerId: 1,
        })
      );
      expect(s.commits.at(-1)?.[0][0]).toEqual([true, true, true, true]);
      s.unmount();
    });

    test("a stroke quicker than a frame paints every cell on its way", async () => {
      const s = await render(mount);
      await s.act(() => {
        pointer(s.cell(0, 1), "pointerdown", {
          clientX: 150,
          clientY: 25,
          pointerId: 1,
        });
        // One move from the second step to the last, past the third.
        pointer(s.cell(0, 1), "pointermove", {
          clientX: 350,
          clientY: 25,
          pointerId: 1,
        });
      });
      await frame();
      await s.act(() => undefined);
      expect(s.changes.at(-1)?.[0][0]).toEqual([true, true, true, true]);
      s.unmount();
    });

    test("Enter and Space flip a step from the keyboard, with a keyboard reason", async () => {
      const s = await render(mount);
      s.cell(1, 0).focus();
      await s.act(() => key(s.cell(1, 0), " "));
      expect(s.changes.at(-1)?.[0][1]).toEqual([true, false, true, false]);
      expect(s.changes.at(-1)?.[1]).toBe("keyboard");
      expect(s.cell(1, 0).getAttribute("aria-pressed")).toBe("true");
      s.unmount();
    });

    test("the cells are one tab stop, and the arrows walk them by a step and by a row", async () => {
      const s = await render(mount);
      expect(s.cells().map((cell) => cell.getAttribute("tabindex"))).toEqual([
        "0",
        "-1",
        "-1",
        "-1",
        "-1",
        "-1",
        "-1",
        "-1",
      ]);
      s.cell(0, 0).focus();
      await s.act(() => key(s.cell(0, 0), "ArrowRight"));
      expect(document.activeElement).toBe(s.cell(0, 1));
      await s.act(() => key(s.cell(0, 1), "ArrowDown"));
      expect(document.activeElement).toBe(s.cell(1, 1));
      await s.act(() => key(s.cell(1, 1), "End"));
      expect(document.activeElement).toBe(s.cell(1, 3));
      s.unmount();
    });

    test("Page Down and Page Up cross the rows, and Control with Home or End goes to a corner", async () => {
      const s = await render(mount);
      s.cell(0, 1).focus();
      await s.act(() => key(s.cell(0, 1), "PageDown"));
      expect(document.activeElement).toBe(s.cell(1, 1));
      await s.act(() => key(s.cell(1, 1), "PageUp"));
      expect(document.activeElement).toBe(s.cell(0, 1));
      await s.act(() => key(s.cell(0, 1), "End", { ctrlKey: true }));
      expect(document.activeElement).toBe(s.cell(1, 3));
      await s.act(() => key(s.cell(1, 3), "Home", { ctrlKey: true }));
      expect(document.activeElement).toBe(s.cell(0, 0));
      expect(s.cell(0, 0).getAttribute("tabindex")).toBe("0");
      s.unmount();
    });

    test("right to left, the left and right arrows walk the way the steps read", async () => {
      const s = await render(mount);
      s.root.setAttribute("dir", "rtl");
      s.root.style.direction = "rtl";
      s.cell(0, 1).focus();
      await s.act(() => key(s.cell(0, 1), "ArrowLeft"));
      expect(document.activeElement).toBe(s.cell(0, 2));
      await s.act(() => key(s.cell(0, 2), "ArrowRight"));
      expect(document.activeElement).toBe(s.cell(0, 1));
      s.unmount();
    });

    test("a controlled pattern is the one drawn", async () => {
      const s = await render(mount, { value: [[false, true, false, false]] });
      expect(s.rows()).toHaveLength(1);
      expect(s.cell(0, 1).getAttribute("aria-pressed")).toBe("true");
      expect(s.cell(0, 0).getAttribute("aria-pressed")).toBe("false");
      s.unmount();
    });

    test("cancel() in onValueChange keeps the pattern as it was", async () => {
      const s = await render(mount, {
        onValueChange: (_value, details) => details.cancel(),
      });
      await s.act(() => key(s.cell(0, 1), " "));
      expect(s.cell(0, 1).getAttribute("aria-pressed")).toBe("false");
      expect(s.commits).toEqual([]);
      s.unmount();
    });

    test("the step being played is marked with data-current from a live source", async () => {
      const { createSource } = await import("@/registry/primitives/primitive");
      const source = createSource(0);
      const s = await render(mount, { source });
      expect(s.cell(0, 0).hasAttribute("data-current")).toBe(true);
      await s.act(() => source.set(2));
      expect(s.cell(0, 0).hasAttribute("data-current")).toBe(false);
      expect(s.cell(0, 2).hasAttribute("data-current")).toBe(true);
      s.unmount();
    });

    test("a velocity bar per step, its height the velocity, drawn by a press", async () => {
      const s = await render(mount, {}, { velocityBars: true });
      expect(s.velocities()).toHaveLength(8);
      expect(styleOf(s.velocities()[0])).toContain("--sequencer-velocity: 1");
      await s.act(() =>
        pointer(s.velocities()[1] as HTMLElement, "pointerdown", {
          clientX: 125,
          clientY: 0,
          pointerId: 1,
        })
      );
      const velocity = s.velocities()[1] as HTMLElement;
      expect(styleOf(velocity)).toContain("--sequencer-velocity: 1");
      s.unmount();
    });

    test("the keys of a velocity bar move it, and Delete brings it back to full", async () => {
      const s = await render(mount, {}, { velocityBars: true });
      const input = s
        .velocities()[0]
        ?.querySelector('input[type="range"]') as HTMLInputElement;
      await s.act(() => key(input, "ArrowDown"));
      expect(styleOf(s.velocities()[0])).toContain(
        "--sequencer-velocity: 0.95"
      );
      await s.act(() => key(input, "Delete"));
      expect(styleOf(s.velocities()[0])).toContain("--sequencer-velocity: 1");
      s.unmount();
    });

    test("a disabled sequencer paints nothing, and says so", async () => {
      const s = await render(mount, { disabled: true });
      await s.act(() =>
        pointer(s.cell(0, 1), "pointerdown", {
          clientX: 150,
          clientY: 25,
          pointerId: 1,
        })
      );
      expect(s.changes).toEqual([]);
      expect(s.root.hasAttribute("data-disabled")).toBe(true);
      expect(
        s.cells().every((cell) => (cell as HTMLButtonElement).disabled)
      ).toBe(true);
      s.unmount();
    });
  });
}
