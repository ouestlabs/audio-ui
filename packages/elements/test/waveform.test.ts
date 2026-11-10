import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import "../src/waveform/index.ts";
import type {
  WaveformBarsElement,
  WaveformControlElement,
  WaveformElement,
  WaveformHoverElement,
  WaveformRegionElement,
} from "../src/waveform/index.ts";
import { installFrames, key, mockRect, pointer } from "./helpers.ts";

/** A 100-second waveform over a 200px control: 2px per second. */
function renderWaveform(attributes = "", inside = "") {
  document.body.innerHTML = `
    <audio-ui-waveform duration="100" ${attributes}>
      <audio-ui-waveform-control aria-label="Seek">
        <audio-ui-waveform-playhead></audio-ui-waveform-playhead>
        ${inside}
      </audio-ui-waveform-control>
    </audio-ui-waveform>`;
  const root = document.querySelector("audio-ui-waveform") as WaveformElement;
  const control = root.querySelector(
    "audio-ui-waveform-control"
  ) as WaveformControlElement;
  mockRect(control, { bottom: 40, height: 40, right: 200, width: 200 });
  const changes: [number, string][] = [];
  const commits: [number, string][] = [];
  root.addEventListener("input", (event) =>
    changes.push([event.detail.value, event.detail.reason])
  );
  root.addEventListener("change", (event) =>
    commits.push([event.detail.value, event.detail.reason])
  );
  return {
    changes,
    commits,
    control,
    input: control.input,
    position: () => root.style.getPropertyValue("--waveform-position"),
    root,
  };
}

describe("the waveform's seek", () => {
  test("its control holds a named native range input over the stretch shown", () => {
    const { control, input, position } = renderWaveform('value="25"');
    expect(input.type).toBe("range");
    expect(input.getAttribute("aria-label")).toBe("Seek");
    expect(control.hasAttribute("aria-label")).toBe(false);
    expect([input.min, input.max, input.value]).toEqual(["0", "100", "25"]);
    expect(input.getAttribute("aria-valuetext")).toBe("25%");
    expect(position()).toBe("25%");
  });

  test("a press jumps to the pointer, a drag scrubs, release commits", () => {
    const { changes, commits, control, position } = renderWaveform();
    pointer(control, "pointerdown", { clientX: 60, clientY: 20, pointerId: 1 });
    expect(changes.at(-1)).toEqual([30, "press"]);
    expect(control.hasAttribute("data-dragging")).toBe(true);
    pointer(control, "pointermove", {
      clientX: 100,
      clientY: 20,
      pointerId: 1,
    });
    expect(changes.at(-1)).toEqual([50, "drag"]);
    expect(position()).toBe("50%");
    pointer(control, "pointerup", { clientX: 100, clientY: 20, pointerId: 1 });
    expect(commits.at(-1)).toEqual([50, "drag"]);
    expect(control.hasAttribute("data-dragging")).toBe(false);
  });

  test("the keys seek and commit; disabled, or loading, nothing moves", () => {
    const { changes, commits, input, root } =
      renderWaveform('default-value="50"');
    key(input, "PageUp");
    expect(commits.at(-1)).toEqual([60, "keyboard"]);
    key(input, "ArrowLeft", { shiftKey: true });
    expect(changes.at(-1)?.[0]).toBe(50);
    root.setAttribute("loading", "");
    expect(root.hasAttribute("data-loading")).toBe(true);
    key(input, "End");
    root.removeAttribute("loading");
    root.setAttribute("disabled", "");
    key(input, "End");
    expect(changes.at(-1)?.[0]).toBe(50);
    expect(input.disabled).toBe(true);
  });

  test("a position set from outside follows a scrub and the keys, and preventDefault() refuses a seek", () => {
    const { control, input, position, root } = renderWaveform('value="10"');
    pointer(control, "pointerdown", { clientX: 100, pointerId: 1 });
    expect(position()).toBe("50%");
    pointer(control, "pointerup", { clientX: 100, pointerId: 1 });
    expect(position()).toBe("50%");
    key(input, "PageUp");
    expect(root.value).toBe(60);
    root.addEventListener("input", (event) => event.preventDefault());
    root.value = 20;
    pointer(control, "pointerdown", { clientX: 160, pointerId: 2 });
    expect(position()).toBe("20%");
  });

  test("follows a live source, and marks a position outside the stretch shown", () => {
    const { input, position, root } = renderWaveform('range="0 50"');
    const source = createSource(10);
    root.source = source;
    expect(position()).toBe("20%");
    source.set(25);
    expect(position()).toBe("50%");
    expect(input.getAttribute("aria-valuetext")).toBe("25%");
    source.set(75);
    expect(position()).toBe("100%");
    expect(root.hasAttribute("data-outside")).toBe(true);
  });

  test("getAriaValueText says how the position is announced", () => {
    const { control, input, root } = renderWaveform('value="30"');
    control.getAriaValueText = (value) => `${value} seconds`;
    root.value = 31;
    expect(input.getAttribute("aria-valuetext")).toBe("31 seconds");
  });

  test("with selectable, a Shift drag selects a stretch instead of seeking", () => {
    const { changes, control } = renderWaveform();
    const selected: [number, number][] = [];
    const committed: [number, number][] = [];
    control.addEventListener("selectioninput", (event) =>
      selected.push((event as CustomEvent).detail.value)
    );
    control.addEventListener("selectioncommit", (event) =>
      committed.push((event as CustomEvent).detail.value)
    );
    control.setAttribute("selectable", "");
    pointer(control, "pointerdown", {
      clientX: 40,
      pointerId: 1,
      shiftKey: true,
    });
    pointer(control, "pointermove", {
      clientX: 120,
      pointerId: 1,
      shiftKey: true,
    });
    pointer(control, "pointerup", { clientX: 120, pointerId: 1 });
    expect(selected.at(-1)).toEqual([20, 60]);
    expect(committed.at(-1)).toEqual([20, 60]);
    expect(changes).toHaveLength(0);
  });
});

describe("the waveform's marks", () => {
  test("a hover follows the pointer and writes where it is, and goes when it leaves", () => {
    const { control, root } = renderWaveform(
      "",
      "<audio-ui-waveform-hover></audio-ui-waveform-hover>"
    );
    const hover = root.querySelector(
      "audio-ui-waveform-hover"
    ) as WaveformHoverElement;
    expect(hover.style.display).toBe("none");
    hover.format = (value) => `${value}s`;
    pointer(control, "pointermove", { clientX: 50 });
    expect(hover.style.display).toBe("");
    expect(hover.style.left).toBe("25%");
    expect(hover.textContent).toBe("25s");
    expect(hover.getAttribute("aria-hidden")).toBe("true");
    control.dispatchEvent(new PointerEvent("pointerleave"));
    expect(hover.style.display).toBe("none");
  });

  test("a marker sits at its value along the stretch shown", () => {
    const { root } = renderWaveform(
      'range="20 60"',
      '<audio-ui-waveform-marker value="40">Drop</audio-ui-waveform-marker>'
    );
    const marker = root.querySelector(
      "audio-ui-waveform-marker"
    ) as HTMLElement;
    expect(marker.style.left).toBe("50%");
    expect(marker.textContent).toBe("Drop");
  });
});

describe("the waveform's region", () => {
  function renderRegion(attributes = 'default-value="20 60"') {
    const view = renderWaveform(
      "",
      `<audio-ui-waveform-region ${attributes}>
        <audio-ui-waveform-region-handle aria-label="Loop start" edge="start"></audio-ui-waveform-region-handle>
        <audio-ui-waveform-region-handle aria-label="Loop end" edge="end"></audio-ui-waveform-region-handle>
      </audio-ui-waveform-region>`
    );
    const region = view.root.querySelector(
      "audio-ui-waveform-region"
    ) as WaveformRegionElement;
    const [start, end] = region.querySelectorAll<HTMLElement>(
      "audio-ui-waveform-region-handle"
    );
    const moves: [readonly number[], string, string][] = [];
    region.addEventListener("regioninput", (event) => {
      const { detail } = event as CustomEvent;
      moves.push([detail.value, detail.edge, detail.reason]);
    });
    return {
      ...view,
      end: end as HTMLElement,
      moves,
      region,
      span: () => [region.style.left, region.style.width],
      start: start as HTMLElement,
    };
  }

  test("spans from its start to its end; dragging its body moves it without seeking", () => {
    const { changes, moves, region, span } = renderRegion();
    expect(span()).toEqual(["20%", "40%"]);
    pointer(region, "pointerdown", { clientX: 80, pointerId: 1 });
    expect(region.hasAttribute("data-dragging")).toBe(true);
    pointer(region, "pointermove", { clientX: 100, pointerId: 1 });
    expect(moves.at(-1)).toEqual([[30, 70], "both", "drag"]);
    expect(span()).toEqual(["30%", "40%"]);
    pointer(region, "pointerup", { clientX: 100, pointerId: 1 });
    expect(changes).toHaveLength(0);
  });

  test("its handles hold named inputs bounded by the other edge, and the keys move them", () => {
    const { end, moves, span, start } = renderRegion();
    const startInput = start.querySelector("input") as HTMLInputElement;
    const endInput = end.querySelector("input") as HTMLInputElement;
    expect(startInput.getAttribute("aria-label")).toBe("Loop start");
    expect(start.getAttribute("data-edge")).toBe("start");
    expect([startInput.min, startInput.max, startInput.value]).toEqual([
      "0",
      "59",
      "20",
    ]);
    expect(endInput.getAttribute("aria-valuetext")).toBe("60%");
    key(endInput, "ArrowRight");
    expect(moves.at(-1)).toEqual([[20, 61], "end", "keyboard"]);
    expect(span()).toEqual(["20%", "41%"]);
    expect(startInput.max).toBe("60");
  });

  test("dragging a handle resizes its edge", () => {
    const { moves, start } = renderRegion();
    pointer(start, "pointerdown", { clientX: 40, pointerId: 1 });
    pointer(start, "pointermove", { clientX: 20, pointerId: 1 });
    expect(moves.at(-1)).toEqual([[10, 60], "start", "drag"]);
  });

  test('movable="false" keeps the body still, and a region set from outside follows its drags', () => {
    const fixed = renderRegion('default-value="20 60" movable="false"');
    pointer(fixed.region, "pointerdown", { clientX: 80, pointerId: 1 });
    pointer(fixed.region, "pointermove", { clientX: 100, pointerId: 1 });
    expect(fixed.moves).toHaveLength(0);
    expect(fixed.changes).toHaveLength(0);

    const held = renderRegion('value="20 60"');
    pointer(held.region, "pointerdown", { clientX: 80, pointerId: 1 });
    pointer(held.region, "pointermove", { clientX: 100, pointerId: 1 });
    pointer(held.region, "pointerup", { clientX: 100, pointerId: 1 });
    held.region.setAttribute("min-length", "2");
    expect(held.span()).toEqual(["30%", "40%"]);
  });
});

describe("the waveform's bars", () => {
  let frames: ReturnType<typeof installFrames>;
  beforeEach(() => {
    frames = installFrames();
  });
  afterEach(() => {
    frames.restore();
  });

  const levelOf = (bar: Element) =>
    Number((bar as HTMLElement).style.getPropertyValue("--waveform-level"));

  test("makes one bar per count, each at its level from the peaks", () => {
    const { root } = renderWaveform(
      "",
      '<audio-ui-waveform-bars count="3"></audio-ui-waveform-bars>'
    );
    root.peaks = [0.2, 0.9, 0.5, 0.5, 0.1, 0.7];
    const bars = [...root.querySelectorAll("audio-ui-waveform-bar")];
    expect(bars).toHaveLength(3);
    expect(bars.map((bar) => bar.getAttribute("index"))).toEqual([
      "0",
      "1",
      "2",
    ]);
    expect(bars.map(levelOf)).toEqual([0.9, 0.5, 0.7]);
  });

  test("follows a live signal, and marks the bars the position has passed", () => {
    const { root } = renderWaveform(
      'value="60"',
      '<audio-ui-waveform-bars count="2" min-level="0"></audio-ui-waveform-bars>'
    );
    const levels = createSource<ArrayLike<number>>([0, 0]);
    root.levels = levels;
    const bars = [...root.querySelectorAll("audio-ui-waveform-bar")];
    levels.set([0.6, 0.3]);
    frames.fire(1000);
    expect(bars.map(levelOf)).toEqual([0.6, 0.3]);
    expect(root.hasAttribute("data-active")).toBe(true);
    expect(bars.map((bar) => bar.hasAttribute("data-played"))).toEqual([
      true,
      false,
    ]);
  });

  test("makes the bars again when count changes", () => {
    const { root } = renderWaveform(
      "",
      '<audio-ui-waveform-bars count="2"></audio-ui-waveform-bars>'
    );
    const bars = root.querySelector(
      "audio-ui-waveform-bars"
    ) as WaveformBarsElement;
    bars.setAttribute("count", "5");
    expect(root.querySelectorAll("audio-ui-waveform-bar")).toHaveLength(5);
  });

  test("a canvas holds the canvas it draws on, hidden from assistive technology", () => {
    const { root } = renderWaveform(
      "",
      "<audio-ui-waveform-canvas></audio-ui-waveform-canvas>"
    );
    const canvas = root.querySelector("audio-ui-waveform-canvas");
    expect(canvas?.querySelector("canvas")).not.toBeNull();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  });
});
