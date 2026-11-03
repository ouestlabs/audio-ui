import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { installFrames } from "../../test/helpers.ts";
import {
  createEdgeScroll,
  edgeScrollStep,
  scrollParent,
} from "./edge-scroll.ts";

/** A view 200 px wide and 100 px tall at the top left of the window, with more to show than it does. */
function view(overflow = "auto") {
  const element = document.createElement("div");
  element.style.overflowX = overflow;
  element.style.overflowY = overflow;
  let left = 0;
  let top = 0;
  Object.defineProperties(element, {
    clientHeight: { value: 100 },
    clientWidth: { value: 200 },
    offsetWidth: { value: 200 },
    scrollHeight: { value: 400 },
    scrollLeft: {
      get: () => left,
      set: (next: number) => {
        left = Math.max(0, Math.min(800, next));
      },
    },
    scrollTop: {
      get: () => top,
      set: (next: number) => {
        top = Math.max(0, Math.min(300, next));
      },
    },
    scrollWidth: { value: 1000 },
  });
  element.getBoundingClientRect = () =>
    ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
    }) as DOMRect;
  document.body.append(element);
  return element;
}

describe("edgeScrollStep", () => {
  test("is still away from the edges, and faster the nearer the pointer is to one", () => {
    expect(edgeScrollStep(100, 0, 200)).toBe(0);
    expect(edgeScrollStep(190, 0, 200)).toBe(13);
    expect(edgeScrollStep(10, 0, 200)).toBe(-13);
  });

  test("goes no faster than 24 px a frame, however far past the edge", () => {
    expect(edgeScrollStep(500, 0, 200)).toBe(24);
    expect(edgeScrollStep(-300, 0, 200)).toBe(-24);
  });
});

describe("scrollParent", () => {
  test("finds the nearest element that scrolls along the axis", () => {
    const outer = view();
    const inner = document.createElement("div");
    outer.append(inner);
    expect(scrollParent(inner, "x")).toBe(outer);
    expect(scrollParent(inner, "y")).toBe(outer);
  });

  test("skips one that does not let its content scroll", () => {
    const outer = view("hidden");
    const inner = document.createElement("div");
    outer.append(inner);
    expect(scrollParent(inner, "x")).toBeNull();
  });
});

describe("createEdgeScroll", () => {
  let frames: ReturnType<typeof installFrames>;
  beforeEach(() => {
    frames = installFrames();
  });
  afterEach(() => {
    frames.restore();
    document.body.replaceChildren();
  });

  test("held near an edge, it scrolls every frame and says how far it has gone", () => {
    const element = view();
    let scrolls = 0;
    const scroll = createEdgeScroll({ x: { element }, y: { element } }, () => {
      scrolls += 1;
    });
    scroll.follow(150, 50);
    scroll.follow(195, 95);
    frames.fire(16);
    frames.fire(32);
    expect(element.scrollLeft).toBe(30);
    expect(element.scrollTop).toBe(30);
    expect(scrolls).toBe(2);
    expect(scroll.shift()).toEqual({ x: 30, y: 30 });
    scroll.stop();
  });

  test("away from the edges, or at the end of what there is to show, it sleeps", () => {
    const element = view();
    const scroll = createEdgeScroll({ x: { element } }, () => undefined);
    scroll.follow(150, 50);
    scroll.follow(100, 50);
    frames.fire(16);
    expect(element.scrollLeft).toBe(0);
    expect(frames.pendingCount()).toBe(0);
    scroll.follow(10, 50);
    frames.fire(32);
    expect(frames.pendingCount()).toBe(0);
    scroll.stop();
  });

  test("the edge zone starts after what sticky content covers", () => {
    const element = view();
    element.scrollLeft = 100;
    const scroll = createEdgeScroll(
      { x: { covered: 120, element } },
      () => undefined
    );
    scroll.follow(150, 50);
    // 130 px is over the lanes, 10 px past the headers: the view scrolls back.
    scroll.follow(130, 50);
    frames.fire(16);
    expect(element.scrollLeft).toBeLessThan(100);
    scroll.stop();
  });

  test("stops for good when the drag ends", () => {
    const element = view();
    const scroll = createEdgeScroll({ x: { element } }, () => undefined);
    scroll.follow(150, 50);
    scroll.follow(195, 50);
    scroll.stop();
    frames.fire(16);
    expect(element.scrollLeft).toBe(0);
  });
});
