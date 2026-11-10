import { describe, expect, test } from "bun:test";
import "../src/pad/index.ts";
import type {
  PadElement,
  PadOffDetail,
  PadOnDetail,
} from "../src/pad/index.ts";
import { key, mockRect, pointer } from "./helpers.ts";

/** Kick, snare, clap and tom on the first row, then the hats sharing a choke group. */
const PADS = [
  { value: "kick" },
  { value: "snare" },
  { value: "clap" },
  { value: "tom" },
  { chokeGroup: "hat", value: "closed" },
  { chokeGroup: "hat", value: "open" },
];

/** Six pads, four to a row, each 100 px tall at the origin. */
function renderPad(attributes = "", disabledPads: string[] = []) {
  document.body.innerHTML = `
    <audio-ui-pad aria-label="Drum pads" ${attributes}>
      ${PADS.map(
        (item) =>
          `<audio-ui-pad-item value="${item.value}"${item.chokeGroup ? ` choke-group="${item.chokeGroup}"` : ""}${disabledPads.includes(item.value) ? " disabled" : ""}>${item.value}</audio-ui-pad-item>`
      ).join("")}
    </audio-ui-pad>`;
  const root = document.querySelector("audio-ui-pad") as PadElement;
  const pad = (value: string) =>
    root.querySelector(`[value="${value}"]`) as HTMLElement;
  for (const { value } of PADS) {
    mockRect(pad(value), { bottom: 100, height: 100, right: 100, width: 100 });
  }
  const on: PadOnDetail[] = [];
  const off: PadOffDetail[] = [];
  root.addEventListener("padon", (event) => on.push(event.detail));
  root.addEventListener("padoff", (event) => off.push(event.detail));
  return { off, on, pad, root };
}

const strike = (y = 50, pointerId = 1) => ({
  clientX: 50,
  clientY: y,
  pointerId,
  pointerType: "mouse",
});

describe("the pad grid", () => {
  test("is a group of pads, each a button named by its content", () => {
    const { pad, root } = renderPad();
    expect(root.getAttribute("role")).toBe("group");
    expect(pad("kick").getAttribute("role")).toBe("button");
    expect(pad("kick").textContent).toBe("kick");
  });

  test("a pad sounds from the strike until the pointer is released", () => {
    const { off, on, pad } = renderPad();
    pointer(pad("kick"), "pointerdown", strike());
    expect(on.at(-1)).toMatchObject({ reason: "press", value: "kick" });
    expect(pad("kick").hasAttribute("data-active")).toBe(true);
    pointer(pad("kick"), "pointerup", strike());
    expect(off.at(-1)).toEqual({ reason: "press", value: "kick" });
    expect(pad("kick").hasAttribute("data-active")).toBe(false);
  });

  test("a strike near the top of a pad is harder, and shown in --pad-velocity", () => {
    const { on, pad } = renderPad();
    pointer(pad("kick"), "pointerdown", strike(5));
    pointer(pad("kick"), "pointerup", strike(5));
    const hard = on.at(-1)?.velocity ?? 0;
    pointer(pad("kick"), "pointerdown", strike(95, 2));
    const soft = on.at(-1)?.velocity ?? 0;
    expect(hard).toBeGreaterThan(soft);
    expect(pad("kick").style.getPropertyValue("--pad-velocity")).toBe(
      String(soft)
    );
  });

  test("each pointer holds its own pad", () => {
    const { pad } = renderPad();
    pointer(pad("kick"), "pointerdown", strike(50, 1));
    pointer(pad("snare"), "pointerdown", strike(50, 2));
    pointer(pad("kick"), "pointerup", strike(50, 1));
    expect(pad("kick").hasAttribute("data-active")).toBe(false);
    expect(pad("snare").hasAttribute("data-active")).toBe(true);
  });

  test("a canceled padon keeps it silent, with nothing to release", () => {
    const { off, pad, root } = renderPad();
    root.addEventListener("padon", (event) => event.preventDefault());
    pointer(pad("kick"), "pointerdown", strike());
    expect(pad("kick").hasAttribute("data-active")).toBe(false);
    pointer(pad("kick"), "pointerup", strike());
    expect(off).toEqual([]);
  });

  test("striking a hat chokes the other one, even after it was released", () => {
    const { off, pad } = renderPad();
    pointer(pad("open"), "pointerdown", strike());
    pointer(pad("open"), "pointerup", strike());
    pointer(pad("closed"), "pointerdown", strike(50, 2));
    expect(off.at(-1)).toEqual({ reason: "choke", value: "open" });
  });

  test("lights active-pads alongside the held ones, and the activePads property", () => {
    const { pad, root } = renderPad('active-pads="clap"');
    pointer(pad("kick"), "pointerdown", strike());
    expect(pad("kick").hasAttribute("data-active")).toBe(true);
    expect(pad("clap").hasAttribute("data-active")).toBe(true);
    expect(pad("snare").hasAttribute("data-active")).toBe(false);
    root.activePads = ["tom"];
    expect(pad("clap").hasAttribute("data-active")).toBe(false);
    expect(pad("tom").hasAttribute("data-active")).toBe(true);
  });

  test("ignores the pointer when disabled", () => {
    const { on, pad, root } = renderPad("disabled");
    pointer(pad("kick"), "pointerdown", strike());
    expect(on).toEqual([]);
    expect(root.hasAttribute("data-disabled")).toBe(true);
  });
});

describe("a pad", () => {
  test("the single tab stop is on the first enabled pad", () => {
    const { pad } = renderPad("", ["kick"]);
    const stops = PADS.map(({ value }) => pad(value)).filter(
      (element) => element.tabIndex === 0
    );
    expect(stops).toEqual([pad("snare")]);
  });

  test("the arrows walk the pads, up and down by a row, Home and End to the ends", () => {
    const { pad } = renderPad();
    key(pad("kick"), "ArrowRight");
    expect(document.activeElement).toBe(pad("snare"));
    expect(pad("snare").tabIndex).toBe(0);
    expect(pad("kick").tabIndex).toBe(-1);
    key(pad("snare"), "ArrowDown");
    expect(document.activeElement).toBe(pad("open"));
    key(pad("open"), "ArrowDown");
    expect(document.activeElement).toBe(pad("open"));
    key(pad("open"), "Home");
    expect(document.activeElement).toBe(pad("kick"));
    key(pad("kick"), "End");
    expect(document.activeElement).toBe(pad("open"));
  });

  test("steps over a disabled pad", () => {
    const { pad } = renderPad("", ["snare"]);
    key(pad("kick"), "ArrowRight");
    expect(document.activeElement).toBe(pad("clap"));
  });

  test("sounds while Enter or Space is held, once however long the key repeats", () => {
    const { off, on, pad } = renderPad();
    key(pad("kick"), " ");
    key(pad("kick"), " ", { repeat: true });
    expect(on).toEqual([{ reason: "keyboard", value: "kick", velocity: 0.8 }]);
    expect(pad("kick").hasAttribute("data-active")).toBe(true);
    pad("kick").dispatchEvent(
      new KeyboardEvent("keyup", { bubbles: true, key: " " })
    );
    expect(off.at(-1)).toEqual({ reason: "keyboard", value: "kick" });
    expect(pad("kick").hasAttribute("data-active")).toBe(false);
  });

  test("a held pad is released when it loses focus", () => {
    const { off, pad } = renderPad();
    key(pad("kick"), "Enter");
    pad("kick").dispatchEvent(new FocusEvent("blur"));
    expect(off.at(-1)?.value).toBe("kick");
  });

  test("a disabled pad is silent, and the only one", () => {
    const { on, pad } = renderPad("", ["kick"]);
    pointer(pad("kick"), "pointerdown", { pointerId: 1 });
    key(pad("kick"), "Enter");
    expect(on).toEqual([]);
    expect(pad("kick").hasAttribute("data-disabled")).toBe(true);
    expect(pad("kick").getAttribute("aria-disabled")).toBe("true");
    expect(pad("snare").hasAttribute("data-disabled")).toBe(false);
  });

  test("a pad added later takes its place in the reading order", () => {
    const { pad, root } = renderPad();
    const extra = document.createElement("audio-ui-pad-item");
    extra.setAttribute("value", "cowbell");
    pad("kick").after(extra);
    key(pad("kick"), "ArrowRight");
    expect(document.activeElement).toBe(extra);
    expect(root.querySelectorAll("audio-ui-pad-item")).toHaveLength(7);
  });
});
