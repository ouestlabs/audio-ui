import { describe, expect, test } from "bun:test";
import { pitchName } from "@/registry/primitives/pitch";
import { key, mockRect, pointer } from "./helpers.ts";

/**
 * One suite for the piano in every framework: it writes no markup of its own,
 * only drives the DOM a framework renders from the same `piano.ts`, and finds
 * each part by its `data-slot`.
 */

interface OnDetails {
  cancel: () => void;
  reason: string;
  source?: string;
  velocity: number;
}

export interface PianoOptions {
  onNoteOn?: (pitch: number, details: OnDetails) => void;
  [option: string]: unknown;
}

/** What the suite asks a framework to render. */
export interface PianoTree {
  /** Whether each key has a label part. */
  labels?: boolean;
  options: PianoOptions & {
    onNoteOff: (pitch: number, details: { reason: string }) => void;
    onNoteOn: (pitch: number, details: OnDetails) => void;
  };
}

/** A keyboard a framework rendered. */
export interface Mounted {
  act: (interact: () => void) => Promise<void>;
  container: HTMLElement;
  unmount: () => void;
}

export type MountPiano = (tree: PianoTree) => Promise<Mounted>;

/** Three keys of equal share, so a press at x reads straight off the pitch. */
const EVEN = { layout: "even", maxPitch: 62, minPitch: 60 };

async function render(
  mount: MountPiano,
  options: PianoOptions = {},
  extra: Pick<PianoTree, "labels"> = {}
) {
  const ons: [number, string, number, string | undefined][] = [];
  const offs: [number, string][] = [];
  const mounted = await mount({
    options: {
      ...EVEN,
      ...options,
      onNoteOff: (pitch, details) => {
        offs.push([pitch, details.reason]);
      },
      onNoteOn: (pitch, details) => {
        ons.push([pitch, details.reason, details.velocity, details.source]);
        options.onNoteOn?.(pitch, details);
      },
    },
    ...extra,
  });
  const root = mounted.container.querySelector(
    '[data-slot="piano"]'
  ) as HTMLElement;
  // A 300×100 keyboard at the origin: the keys of 100 px each, from the left.
  mockRect(root, { bottom: 100, height: 100, right: 300, width: 300 });
  const keys = () => [
    ...mounted.container.querySelectorAll<HTMLElement>(
      '[data-slot="piano-key"]'
    ),
  ];
  return {
    ...mounted,
    key: (pitch: number) =>
      keys().find(
        (each) => each.getAttribute("aria-label") === pitchName(pitch)
      ) as HTMLElement,
    keys,
    labels: () => [
      ...mounted.container.querySelectorAll<HTMLElement>(
        '[data-slot="piano-label"]'
      ),
    ],
    offs,
    ons,
    root,
  };
}

const styleOf = (element: HTMLElement | undefined) =>
  element?.getAttribute("style") ?? "";

/** Waits for the frame a drag reports its moves on. */
const frame = () => new Promise((resolve) => setTimeout(resolve, 30));

export function pianoSuite(framework: string, mount: MountPiano) {
  describe(`the piano in ${framework}`, () => {
    test("a group with a button for each pitch, named by its note", async () => {
      const p = await render(mount);
      expect(p.root.getAttribute("role")).toBe("group");
      expect(p.keys().map((each) => each.getAttribute("aria-label"))).toEqual([
        pitchName(60),
        pitchName(61),
        pitchName(62),
      ]);
      expect(p.keys().every((each) => each.tagName === "BUTTON")).toBe(true);
      p.unmount();
    });

    test("a keyboard layout puts the black keys between the white ones", async () => {
      const p = await render(mount, {
        layout: "keyboard",
        maxPitch: 64,
        minPitch: 60,
      });
      expect(p.keys().map((each) => each.getAttribute("data-color"))).toEqual([
        "white",
        "black",
        "white",
        "black",
        "white",
      ]);
      expect(styleOf(p.key(60))).toContain("left: 0%");
      expect(p.root.getAttribute("data-layout")).toBe("keyboard");
      p.unmount();
    });

    test("an even layout gives each key an equal share, and a vertical one runs from the bottom", async () => {
      const even = await render(mount);
      expect(styleOf(even.key(61))).toContain("left: 33.3");
      expect(styleOf(even.key(61))).toContain("width: 33.3");
      even.unmount();
      const vertical = await render(mount, { orientation: "vertical" });
      expect(styleOf(vertical.key(61))).toContain("bottom: 33.3");
      expect(styleOf(vertical.key(61))).toContain("height: 33.3");
      vertical.unmount();
    });

    test("a press strikes the key under the pointer, harder toward its free end, until released", async () => {
      const p = await render(mount);
      await p.act(() =>
        pointer(p.root, "pointerdown", {
          clientX: 150,
          clientY: 100,
          pointerId: 1,
        })
      );
      expect(p.ons).toEqual([[61, "press", 1, "mouse"]]);
      expect(p.key(61).hasAttribute("data-active")).toBe(true);
      await p.act(() =>
        pointer(p.root, "pointerup", {
          clientX: 150,
          clientY: 100,
          pointerId: 1,
        })
      );
      expect(p.offs).toEqual([[61, "press"]]);
      expect(p.key(61).hasAttribute("data-active")).toBe(false);
      await p.act(() =>
        pointer(p.root, "pointerdown", {
          clientX: 50,
          clientY: 0,
          pointerId: 2,
        })
      );
      expect(p.ons.at(-1)?.[2]).toBe(0.25);
      p.unmount();
    });

    test("dragging across the keys glides from one to the next", async () => {
      const p = await render(mount);
      await p.act(() => {
        pointer(p.root, "pointerdown", {
          clientX: 50,
          clientY: 50,
          pointerId: 1,
        });
        pointer(p.root, "pointermove", {
          clientX: 150,
          clientY: 50,
          pointerId: 1,
        });
      });
      await frame();
      await p.act(() => undefined);
      expect(p.offs).toEqual([[60, "glide"]]);
      expect(p.ons.map((on) => [on[0], on[1]])).toEqual([
        [60, "press"],
        [61, "glide"],
      ]);
      expect(p.key(61).hasAttribute("data-active")).toBe(true);
      p.unmount();
    });

    test("each pointer holds its own key, so chords can be played", async () => {
      const p = await render(mount);
      await p.act(() => {
        pointer(p.root, "pointerdown", {
          clientX: 50,
          clientY: 50,
          pointerId: 1,
        });
        pointer(p.root, "pointerdown", {
          clientX: 250,
          clientY: 50,
          pointerId: 2,
        });
      });
      expect(p.key(60).hasAttribute("data-active")).toBe(true);
      expect(p.key(62).hasAttribute("data-active")).toBe(true);
      p.unmount();
    });

    test("Enter and Space play a key from the keyboard until the key is released", async () => {
      const p = await render(mount);
      p.key(62).focus();
      await p.act(() => key(p.key(62), "Enter"));
      expect(p.ons).toEqual([[62, "keyboard", 0.8, "keyboard"]]);
      await p.act(() =>
        p
          .key(62)
          .dispatchEvent(
            new KeyboardEvent("keyup", { bubbles: true, key: "Enter" })
          )
      );
      expect(p.offs).toEqual([[62, "keyboard"]]);
      p.unmount();
    });

    test("notes lit from elsewhere are active", async () => {
      const p = await render(mount, { activeNotes: [61] });
      expect(p.keys().map((each) => each.hasAttribute("data-active"))).toEqual([
        false,
        true,
        false,
      ]);
      p.unmount();
    });

    test("cancel() in onNoteOn keeps the key silent", async () => {
      const p = await render(mount, {
        onNoteOn: (_pitch, details) => details.cancel(),
      });
      await p.act(() =>
        pointer(p.root, "pointerdown", {
          clientX: 150,
          clientY: 50,
          pointerId: 1,
        })
      );
      expect(p.key(61).hasAttribute("data-active")).toBe(false);
      p.unmount();
    });

    test("the keys are one tab stop, from middle C, and the arrows and Home and End walk them", async () => {
      const p = await render(mount);
      expect(p.keys().map((each) => each.getAttribute("tabindex"))).toEqual([
        "0",
        "-1",
        "-1",
      ]);
      p.key(60).focus();
      await p.act(() => key(p.key(60), "ArrowRight"));
      expect(document.activeElement).toBe(p.key(61));
      await p.act(() => key(p.key(61), "End"));
      expect(document.activeElement).toBe(p.key(62));
      await p.act(() => key(p.key(62), "ArrowLeft"));
      expect(document.activeElement).toBe(p.key(61));
      await p.act(() => key(p.key(61), "Home"));
      expect(document.activeElement).toBe(p.key(60));
      expect(p.keys().map((each) => each.getAttribute("tabindex"))).toEqual([
        "0",
        "-1",
        "-1",
      ]);
      p.unmount();
    });

    test("a label names its key, and is hidden from assistive technology", async () => {
      const p = await render(mount, {}, { labels: true });
      expect(p.labels().map((label) => label.textContent?.trim())).toEqual([
        pitchName(60),
        pitchName(61),
        pitchName(62),
      ]);
      expect(p.labels()[0]?.getAttribute("aria-hidden")).toBe("true");
      p.unmount();
    });

    test("a disabled keyboard plays nothing, and says so", async () => {
      const p = await render(mount, { disabled: true });
      await p.act(() =>
        pointer(p.root, "pointerdown", {
          clientX: 150,
          clientY: 50,
          pointerId: 1,
        })
      );
      expect(p.ons).toEqual([]);
      expect(p.root.hasAttribute("data-disabled")).toBe(true);
      expect(
        p.keys().every((each) => (each as HTMLButtonElement).disabled)
      ).toBe(true);
      p.unmount();
    });
  });
}
