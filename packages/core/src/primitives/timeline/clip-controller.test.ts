import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { installFrames } from "../../../test/helpers.ts";
import { type ClipOptions, createClipController } from "./clip-controller.ts";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const create = (options: Partial<ClipOptions> = {}) =>
  createClipController({
    duration: 100,
    grid: { offset: 0, step: 0 },
    largeStep: 10,
    minLength: 1,
    movable: true,
    step: 1,
    zoom: null,
    defaultValue: { fadeIn: 0, fadeOut: 0, length: 20, offset: 0, start: 10 },
    ...options,
  });

describe("Clip controller value", () => {
  test("starts with the default clip, and a controlled clip is shown as given", () => {
    expect(create().getSnapshot().value.start).toBe(10);
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const clip = create({
      onValueChange,
      value: { fadeIn: 0, fadeOut: 0, length: 20, offset: 0, start: 30 },
    });
    clip.moveTypeAt(50, new Event("input"));
    expect(clip.getSnapshot().value.start).toBe(30);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("a clip stays on the timeline and its fades within its length", () => {
    const clip = create({
      defaultValue: {
        fadeIn: 50,
        fadeOut: 50,
        length: 500,
        offset: -3,
        start: 200,
      },
    });
    const { value } = clip.getSnapshot();
    expect(value.start + value.length).toBeLessThanOrEqual(100);
    expect(value.fadeIn + value.fadeOut).toBeLessThanOrEqual(value.length);
    expect(value.offset).toBe(0);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const clip = create();
    expect(clip.getSnapshot()).toBe(clip.getSnapshot());
  });
});

describe("Clip controller keys", () => {
  test("arrows move the clip by a step, Shift by a large step, and it stays on the timeline", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const clip = create({ onValueCommitted });
    expect(clip.keyDown(key("ArrowRight"))).toBe(true);
    expect(clip.getSnapshot().value.start).toBe(11);
    clip.keyDown(key("PageDown"));
    expect(clip.getSnapshot().value.start).toBe(1);
    clip.keyDown(key("End"));
    expect(clip.getSnapshot().value.start).toBe(80);
    expect(onValueCommitted).toHaveBeenCalledTimes(3);
  });

  test("Delete calls onRemove, and a key that is not the clip's is left alone", () => {
    const onRemove = mock((_event: KeyboardEvent) => undefined);
    const clip = create({ onRemove });
    expect(clip.keyDown(key("Delete"))).toBe(true);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(clip.keyDown(key("a"))).toBe(false);
  });

  test("a clip that cannot move ignores the move keys, and a disabled one ignores everything", () => {
    expect(create({ movable: false }).keyDown(key("ArrowRight"))).toBe(false);
    expect(create({ disabled: true }).keyDown(key("ArrowRight"))).toBe(false);
  });
});

describe("Clip controller edges and fades", () => {
  test("a trim edge can move only as far as the source and the timeline let it", () => {
    // The clip starts at 10 on a source it begins at 0 of: it can grow back to
    // there, and shrink to its minimum length; its end can run to the source's end.
    const clip = create({ sourceLength: 30 });
    expect(clip.edgeRange("trim-start")).toEqual([10, 29]);
    expect(clip.edgeRange("trim-end")).toEqual([11, 40]);
  });

  test("a fade is bounded by the other fade, and a fade key moves it", () => {
    const clip = create({
      defaultValue: {
        fadeIn: 0,
        fadeOut: 15,
        length: 20,
        offset: 0,
        start: 10,
      },
    });
    expect(clip.edgeRange("fade-in" as never)).toEqual([0, 5]);
    expect(clip.edgeKeyDown("fade-in", key("End"))).toBe(true);
    expect(clip.getSnapshot().value.fadeIn).toBe(5);
  });

  test("Delete takes a fade away, and leaves a trim edge alone", () => {
    const clip = create({
      defaultValue: { fadeIn: 4, fadeOut: 6, length: 20, offset: 0, start: 10 },
    });
    expect(clip.edgeKeyDown("fade-out", key("Delete"))).toBe(true);
    expect(clip.getSnapshot().value.fadeOut).toBe(0);
    expect(clip.edgeKeyDown("fade-in", key("Backspace"))).toBe(true);
    expect(clip.getSnapshot().value.fadeIn).toBe(0);
    expect(clip.edgeKeyDown("trim-end", key("Delete"))).toBe(false);
  });

  test("a fade shape cycles through its shapes", () => {
    const clip = create();
    const before = clip.getSnapshot().value.fadeInShape;
    clip.cycleFadeShape("in", "double-click", new MouseEvent("dblclick"));
    expect(clip.getSnapshot().value.fadeInShape).not.toBe(before);
  });

  test("an input trims the start to a position", () => {
    const clip = create();
    clip.edgeTypeAt("trim-start", 12, new Event("input"));
    expect(clip.getSnapshot().value.start).toBe(12);
  });
});

describe("Clip controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const clip = create();
    const listener = mock(() => undefined);
    const unsubscribe = clip.subscribe(listener);
    clip.keyDown(key("ArrowRight"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    clip.keyDown(key("ArrowRight"));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("Clip controller snap points", () => {
  const pointer = (type: string, clientX: number) =>
    Object.assign(new Event(type), {
      altKey: false,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX,
      clientY: 0,
      ctrlKey: false,
      metaKey: false,
      pointerId: 1,
      pointerType: "mouse",
      shiftKey: false,
    }) as unknown as PointerEvent;
  const handle = document.createElement("div");

  /** Drags the clip by its header from x = 0 to `to`, 10 px per unit, and lets go. */
  const drag = (points: number[], to: number) => {
    const clip = create({
      grid: { offset: 0, points, step: 0 },
      zoom: 10,
    });
    clip.press("move", pointer("pointerdown", 0), handle, handle);
    document.dispatchEvent(pointer("pointermove", to));
    const { start } = clip.getSnapshot().value;
    document.dispatchEvent(pointer("pointerup", to));
    return start;
  };

  test("a dragged clip lands its end on another clip's edge within a few px", () => {
    // Start 10 + 14.8 = 24.8, so its end is at 44.8, 2 px from 45.
    expect(drag([45], 148)).toBe(25);
  });

  test("further than that, it moves freely", () => {
    expect(drag([45], 100)).toBe(20);
  });

  test("its own edges do not hold it back", () => {
    expect(drag([10, 30], 3)).toBeCloseTo(10.3, 9);
  });
});

describe("Clip controller drag target", () => {
  test("names what a pointer drags, and nothing between drags", () => {
    const handle = document.createElement("div");
    const pointer = (type: string, clientX: number) =>
      Object.assign(new Event(type), {
        altKey: false,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        clientX,
        clientY: 0,
        ctrlKey: false,
        metaKey: false,
        pointerId: 1,
        pointerType: "mouse",
        shiftKey: false,
      }) as unknown as PointerEvent;
    const clip = create({ zoom: 10 });
    expect(clip.getSnapshot().dragTarget).toBeNull();
    clip.press("fade-in", pointer("pointerdown", 0), handle, handle);
    expect(clip.getSnapshot().dragTarget).toBe("fade-in");
    document.dispatchEvent(pointer("pointerup", 0));
    expect(clip.getSnapshot().dragTarget).toBeNull();
  });
});

describe("Clip controller near the edges of its view", () => {
  const pointer = (type: string, clientX: number, clientY = 20) =>
    Object.assign(new Event(type), {
      altKey: false,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX,
      clientY,
      ctrlKey: false,
      metaKey: false,
      pointerId: 1,
      pointerType: "mouse",
      shiftKey: false,
    }) as unknown as PointerEvent;
  const box = (left: number, top: number, width: number, height: number) =>
    ({
      bottom: top + height,
      height,
      left,
      right: left + width,
      top,
      width,
    }) as DOMRect;

  /** A timeline view 200 px wide and 100 px tall that scrolls both ways, with two lanes 50 px tall from x = 0. */
  function timeline() {
    const view = document.createElement("div");
    view.setAttribute("data-timeline-viewport", "");
    view.style.overflowX = "auto";
    view.style.overflowY = "auto";
    let left = 0;
    let top = 0;
    Object.defineProperties(view, {
      clientHeight: { value: 100 },
      clientWidth: { value: 200 },
      offsetWidth: { value: 200 },
      scrollHeight: { value: 400 },
      scrollLeft: {
        get: () => left,
        set: (next: number) => {
          left = Math.max(0, next);
        },
      },
      scrollTop: {
        get: () => top,
        set: (next: number) => {
          top = Math.max(0, next);
        },
      },
      scrollWidth: { value: 1000 },
    });
    view.getBoundingClientRect = () => box(0, 0, 200, 100);
    const lanes = [0, 50].map((y) => {
      const lane = document.createElement("div");
      lane.setAttribute("data-timeline-lane", "");
      lane.getBoundingClientRect = () => box(-left, y - top, 1000, 50);
      view.append(lane);
      return lane;
    });
    const handle = document.createElement("div");
    lanes[0]?.append(handle);
    document.body.append(view);
    return { handle, lanes, view };
  }

  let frames: ReturnType<typeof installFrames>;
  beforeEach(() => {
    frames = installFrames();
  });
  afterEach(() => {
    frames.restore();
    document.body.replaceChildren();
  });

  test("a clip held near the end of the view scrolls it, and stays under the pointer", () => {
    const { handle, lanes, view } = timeline();
    const clip = create({ zoom: 10 });
    clip.press("move", pointer("pointerdown", 100), handle, lanes[0] ?? null);
    document.dispatchEvent(pointer("pointermove", 190));
    expect(clip.getSnapshot().value.start).toBe(19);
    frames.fire(16);
    // 13 px of scroll is 1.3 units more.
    expect(view.scrollLeft).toBe(13);
    expect(clip.getSnapshot().value.start).toBeCloseTo(20.3, 9);
    document.dispatchEvent(pointer("pointerup", 190));
    frames.fire(32);
    expect(view.scrollLeft).toBe(13);
  });

  test("a press alone does not scroll, nor does a fade dragged to the edge", () => {
    const { handle, lanes, view } = timeline();
    const clip = create({ zoom: 10 });
    clip.press("move", pointer("pointerdown", 195), handle, lanes[0] ?? null);
    frames.fire(16);
    document.dispatchEvent(pointer("pointerup", 195));
    clip.press(
      "fade-in",
      pointer("pointerdown", 100),
      handle,
      lanes[0] ?? null
    );
    document.dispatchEvent(pointer("pointermove", 199));
    frames.fire(32);
    document.dispatchEvent(pointer("pointerup", 199));
    expect(view.scrollLeft).toBe(0);
  });

  test("off the lanes, a moved clip goes to the nearest one", () => {
    const { handle, lanes } = timeline();
    const committed = mock();
    const clip = create({ onValueCommitted: committed, zoom: 10 });
    clip.press(
      "move",
      pointer("pointerdown", 100, 20),
      handle,
      lanes[0] ?? null
    );
    document.dispatchEvent(pointer("pointermove", 100, 140));
    document.dispatchEvent(pointer("pointerup", 100, 140));
    expect(committed.mock.calls[0]?.[1].lane).toBe(lanes[1]);
  });
});
