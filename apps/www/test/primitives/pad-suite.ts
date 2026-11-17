import { describe, expect, test } from "bun:test";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the pad grid in every framework: it writes no markup of its
 * own, only drives the DOM a framework renders from the same `pad.ts`, and
 * finds each part by its `data-slot`.
 */

interface OnDetails {
  cancel: () => void;
  reason: string;
  source?: string;
  velocity: number;
}

export interface PadOptions {
  onPadOn?: (value: string, details: OnDetails) => void;
  [option: string]: unknown;
}

/** A pad of the grid. */
export interface PadSpec {
  chokeGroup?: string;
  disabled?: boolean;
  value: string;
}

/** What the suite asks a framework to render. */
export interface PadTree {
  options: PadOptions & {
    onPadOff: (value: string, details: { reason: string }) => void;
    onPadOn: (value: string, details: OnDetails) => void;
  };
  pads: PadSpec[];
}

/** A pad grid a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountPad = (tree: PadTree) => Promise<Mounted>;

const PADS: PadSpec[] = [
  { value: "kick" },
  { value: "snare" },
  { value: "hat" },
  { value: "open" },
  { value: "clap" },
  { value: "tom" },
];

async function render(
  mount: MountPad,
  options: PadOptions = {},
  pads: PadSpec[] = PADS
) {
  const ons: [string, string, number, string | undefined][] = [];
  const offs: [string, string][] = [];
  const mounted = await mount({
    options: {
      columns: 3,
      ...options,
      onPadOff: (value, details) => {
        offs.push([value, details.reason]);
      },
      onPadOn: (value, details) => {
        ons.push([value, details.reason, details.velocity, details.source]);
        options.onPadOn?.(value, details);
      },
    },
    pads,
  });
  const items = [
    ...mounted.container.querySelectorAll<HTMLElement>(
      '[data-slot="pad-item"]'
    ),
  ];
  // Each pad is 100 px tall at the origin, so a strike's height is its velocity.
  for (const item of items) {
    mockRect(item, { bottom: 100, height: 100, right: 100, width: 100 });
  }
  return {
    ...mounted,
    item: (value: string) =>
      items[pads.findIndex((p) => p.value === value)] as HTMLElement,
    items,
    offs,
    ons,
    root: mounted.container.querySelector('[data-slot="pad"]') as HTMLElement,
  };
}

export function padSuite(framework: string, mount: MountPad) {
  describe(`the pad grid in ${framework}`, () => {
    test("a group of buttons", async () => {
      const g = await render(mount);
      expect(g.root.getAttribute("role")).toBe("group");
      expect(g.items).toHaveLength(6);
      expect(g.items.every((item) => item.tagName === "BUTTON")).toBe(true);
      expect(
        g.items.every((item) => item.getAttribute("type") === "button")
      ).toBe(true);
      // A stylesheet lays the grid out by the columns the arrows walk.
      expect(g.root.style.getPropertyValue("--pad-columns")).toBe("3");
      g.unmount();
    });

    test("a press strikes the pad, harder toward its top, and holds it until released", async () => {
      const g = await render(mount);
      await g.act(() =>
        pointer(g.item("kick"), "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        })
      );
      expect(g.ons).toEqual([["kick", "press", 1, "mouse"]]);
      expect(g.item("kick").hasAttribute("data-active")).toBe(true);
      expect(g.item("kick").style.getPropertyValue("--pad-velocity")).toBe("1");
      await g.act(() =>
        pointer(g.item("kick"), "pointerup", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        })
      );
      expect(g.offs).toEqual([["kick", "press"]]);
      expect(g.item("kick").hasAttribute("data-active")).toBe(false);
      await g.act(() =>
        pointer(g.item("snare"), "pointerdown", {
          clientX: 50,
          clientY: 100,
          pointerId: 2,
        })
      );
      expect(g.ons.at(-1)?.[2]).toBe(0.25);
      g.unmount();
    });

    test("Enter and Space strike from the keyboard until the key is released", async () => {
      const g = await render(mount);
      g.item("hat").focus();
      await g.act(() => key(g.item("hat"), "Enter"));
      expect(g.ons).toEqual([["hat", "keyboard", 0.8, "keyboard"]]);
      expect(g.item("hat").hasAttribute("data-active")).toBe(true);
      await g.act(() =>
        g
          .item("hat")
          .dispatchEvent(
            new KeyboardEvent("keyup", { bubbles: true, key: "Enter" })
          )
      );
      expect(g.offs).toEqual([["hat", "keyboard"]]);
      g.unmount();
    });

    test("a pad that loses focus while held stops", async () => {
      const g = await render(mount);
      g.item("kick").focus();
      await g.act(() => key(g.item("kick"), " "));
      await g.act(() => g.item("kick").blur());
      expect(g.offs).toEqual([["kick", "keyboard"]]);
      g.unmount();
    });

    test("pads lit from elsewhere are active", async () => {
      const g = await render(mount, { activePads: ["snare", "tom"] });
      expect(g.items.map((item) => item.hasAttribute("data-active"))).toEqual([
        false,
        true,
        false,
        false,
        false,
        true,
      ]);
      g.unmount();
    });

    test("cancel() in onPadOn keeps the pad silent", async () => {
      const g = await render(mount, {
        onPadOn: (_value, details) => details.cancel(),
      });
      await g.act(() =>
        pointer(g.item("kick"), "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        })
      );
      expect(g.item("kick").hasAttribute("data-active")).toBe(false);
      g.unmount();
    });

    test("a pad of a choke group stops the last one struck", async () => {
      const g = await render(mount, {}, [
        { chokeGroup: "hats", value: "hat" },
        { chokeGroup: "hats", value: "open" },
        { value: "kick" },
      ]);
      await g.act(() =>
        pointer(g.item("hat"), "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        })
      );
      await g.act(() =>
        pointer(g.item("open"), "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 2,
        })
      );
      expect(g.offs).toEqual([["hat", "choke"]]);
      expect(g.item("hat").hasAttribute("data-active")).toBe(false);
      expect(g.item("open").hasAttribute("data-active")).toBe(true);
      g.unmount();
    });

    test("each pointer holds its own pad, so several can sound at once", async () => {
      const g = await render(mount);
      await g.act(() => {
        pointer(g.item("kick"), "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        });
        pointer(g.item("snare"), "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 2,
        });
      });
      expect(g.item("kick").hasAttribute("data-active")).toBe(true);
      expect(g.item("snare").hasAttribute("data-active")).toBe(true);
      await g.act(() =>
        pointer(g.item("kick"), "pointerup", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        })
      );
      expect(g.item("kick").hasAttribute("data-active")).toBe(false);
      expect(g.item("snare").hasAttribute("data-active")).toBe(true);
      g.unmount();
    });

    test("the grid is one tab stop, and the arrows walk it by a pad and by a row", async () => {
      const g = await render(mount);
      expect(g.items.map((item) => item.getAttribute("tabindex"))).toEqual([
        "0",
        "-1",
        "-1",
        "-1",
        "-1",
        "-1",
      ]);
      g.item("kick").focus();
      await g.act(() => key(g.item("kick"), "ArrowRight"));
      expect(document.activeElement).toBe(g.item("snare"));
      await g.act(() => key(g.item("snare"), "ArrowDown"));
      expect(document.activeElement).toBe(g.item("clap"));
      await g.act(() => key(g.item("clap"), "ArrowUp"));
      expect(document.activeElement).toBe(g.item("snare"));
      await g.act(() => key(g.item("snare"), "End"));
      expect(document.activeElement).toBe(g.item("tom"));
      await g.act(() => key(g.item("tom"), "Home"));
      expect(document.activeElement).toBe(g.item("kick"));
      expect(g.items.map((item) => item.getAttribute("tabindex"))).toEqual([
        "0",
        "-1",
        "-1",
        "-1",
        "-1",
        "-1",
      ]);
      g.unmount();
    });

    test("the arrows step over a disabled pad", async () => {
      const g = await render(mount, {}, [
        { value: "kick" },
        { disabled: true, value: "snare" },
        { value: "hat" },
      ]);
      g.item("kick").focus();
      await g.act(() => key(g.item("kick"), "ArrowRight"));
      expect(document.activeElement).toBe(g.item("hat"));
      expect((g.item("snare") as HTMLButtonElement).disabled).toBe(true);
      g.unmount();
    });

    test("a disabled grid strikes nothing, and says so", async () => {
      const g = await render(mount, { disabled: true });
      await g.act(() =>
        pointer(g.item("kick"), "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 1,
        })
      );
      expect(g.ons).toEqual([]);
      expect(g.root.hasAttribute("data-disabled")).toBe(true);
      expect(
        g.items.every((item) => (item as HTMLButtonElement).disabled)
      ).toBe(true);
      g.unmount();
    });
  });
}
