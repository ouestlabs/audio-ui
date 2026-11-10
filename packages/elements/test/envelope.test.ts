import { describe, expect, test } from "bun:test";
import "../src/envelope/index.ts";
import type { EnvelopeElement } from "../src/envelope/index.ts";
import { key, mockRect, pointer } from "./helpers.ts";

type Breakpoint = { curve?: number; x: number; y: number };

/** {0,0} {0.2,1} {0.6,0.5} {1,0}, so positions and keys stay exact. */
const POINTS = "0 0, 0.2 1, 0.6 0.5, 1 0";

/** An envelope over a 200×100 graph at the origin, with its points and segments made from no template. */
function renderEnvelope(attributes = `default-value="${POINTS}"`, inner = "") {
  document.body.innerHTML = `
    <audio-ui-envelope aria-label="Amp" locale="en-US" ${attributes}>
      <audio-ui-envelope-graph>
        <audio-ui-envelope-fill></audio-ui-envelope-fill>
        <audio-ui-envelope-line></audio-ui-envelope-line>
      </audio-ui-envelope-graph>
      <audio-ui-envelope-segments></audio-ui-envelope-segments>
      <audio-ui-envelope-points>${inner}</audio-ui-envelope-points>
    </audio-ui-envelope>`;
  const root = document.querySelector("audio-ui-envelope") as EnvelopeElement;
  const graph = root.querySelector("audio-ui-envelope-graph") as HTMLElement;
  mockRect(graph, { bottom: 100, height: 100, right: 200, width: 200 });
  const changes: [Breakpoint[], string, number][] = [];
  const commits: [Breakpoint[], string, number][] = [];
  root.addEventListener("input", (event) =>
    changes.push([event.detail.value, event.detail.reason, event.detail.index])
  );
  root.addEventListener("change", (event) =>
    commits.push([event.detail.value, event.detail.reason, event.detail.index])
  );
  return {
    changes,
    commits,
    graph,
    line: root.querySelector("audio-ui-envelope-line polyline") as Element,
    point: (index: number) =>
      root.querySelectorAll<HTMLElement>("audio-ui-envelope-point")[
        index
      ] as HTMLElement,
    points: () => [...root.querySelectorAll("audio-ui-envelope-point")],
    root,
    segment: (index: number) =>
      root.querySelectorAll<HTMLElement>("audio-ui-envelope-segment")[
        index
      ] as HTMLElement,
  };
}

/** The next frame, when a refused add or removal shows. */
const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

const doubleClick = (target: Element, init: MouseEventInit = {}) =>
  target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, ...init }));

describe("the envelope's parts", () => {
  test("the root is a named group, and the points are named sliders on their level", () => {
    const { point, points, root } = renderEnvelope();
    expect(root.getAttribute("role")).toBe("group");
    expect(points()).toHaveLength(4);
    expect(point(1).getAttribute("role")).toBe("slider");
    expect(point(1).getAttribute("aria-label")).toBe("Point 2 of 4");
    expect(point(1).getAttribute("aria-valuenow")).toBe("1");
    expect(point(1).getAttribute("aria-valuetext")).toBe("0.2, 1");
    expect(point(2).style.left).toBe("60%");
    expect(point(2).style.bottom).toBe("50%");
  });

  test("draws the line with flat lead-in and lead-out, and the fill closed down to the bottom corners", () => {
    const { line, root } = renderEnvelope();
    const fill = root.querySelector("audio-ui-envelope-fill polyline");
    expect(line.getAttribute("points")).toBe(
      "0,100 0,100 20,0 60,50 100,100 100,100"
    );
    expect(line.getAttribute("fill")).toBe("none");
    expect(fill?.getAttribute("points")).toBe(
      "0,100 0,100 20,0 60,50 100,100 100,100 100,100 0,100"
    );
  });

  test("with no points given it starts from an ADSR shape", () => {
    const { points, root } = renderEnvelope("");
    expect(points()).toHaveLength(5);
    expect(root.value[0]?.y).toBeGreaterThan(0);
  });

  test("reads a curve as a third number, and ignores a value it cannot read", () => {
    expect(renderEnvelope('value="0 0 0.5, 1 1"').root.value).toEqual([
      { curve: 0.5, x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(renderEnvelope('value="0 0, nope"').points()).toHaveLength(5);
  });

  test("label names the points, and each point holds what the template holds", async () => {
    const { point } = renderEnvelope(
      `default-value="${POINTS}"`,
      '<template><span class="dot"></span></template>'
    );
    await Promise.resolve();
    expect(point(0).querySelector(".dot")).not.toBeNull();
    const points = document.querySelector("audio-ui-envelope-points");
    points?.setAttribute("label", "Breakpoint {n}");
    document
      .querySelector<EnvelopeElement>("audio-ui-envelope")
      ?.setAttribute("value", POINTS);
    expect(point(3).getAttribute("aria-label")).toBe("Breakpoint 4");
  });

  test("getPointValueText writes the points in real units", () => {
    const { point, root } = renderEnvelope();
    root.getPointValueText = (p) => `${p.x * 2} s, ${p.y * 100}%`;
    root.paint();
    expect(point(2).getAttribute("aria-valuetext")).toBe("1.2 s, 50%");
  });
});

describe("the envelope's keys", () => {
  test("one point at a time is the tab stop; Page Up and Down, Home and End move between them", () => {
    const { point } = renderEnvelope();
    expect(point(0).tabIndex).toBe(0);
    expect(point(1).tabIndex).toBe(-1);
    point(0).focus();
    key(point(0), "PageUp");
    expect(document.activeElement).toBe(point(1));
    expect(point(1).tabIndex).toBe(0);
    expect(point(0).tabIndex).toBe(-1);
    key(point(1), "End");
    expect(document.activeElement).toBe(point(3));
    key(point(3), "PageDown");
    expect(document.activeElement).toBe(point(2));
    key(point(2), "Home");
    expect(document.activeElement).toBe(point(0));
  });

  test("the arrow keys move the point and commit, with its index", () => {
    const { changes, commits, point } = renderEnvelope();
    key(point(2), "ArrowUp");
    expect(changes.at(-1)?.[0][2]).toEqual({ x: 0.6, y: 0.51 });
    expect(changes.at(-1)?.[1]).toBe("keyboard");
    expect(changes.at(-1)?.[2]).toBe(2);
    expect(commits.at(-1)?.[1]).toBe("keyboard");
    key(point(2), "ArrowLeft", { shiftKey: true });
    expect(changes.at(-1)?.[0][2]?.x).toBeCloseTo(0.5, 5);
  });

  test("Delete removes the point and focus goes to the one in its place; at min-points it is refused", async () => {
    const { changes, point, points } = renderEnvelope(
      `default-value="${POINTS}" min-points="3"`
    );
    point(1).focus();
    key(point(1), "Delete");
    expect(points()).toHaveLength(3);
    expect(changes.at(-1)?.[1]).toBe("remove");
    expect(document.activeElement).toBe(point(1));
    expect(point(1).hasAttribute("data-removable")).toBe(false);
    key(point(1), "Backspace");
    expect(points()).toHaveLength(3);
    await nextFrame();
    expect(point(1).hasAttribute("data-blocked")).toBe(true);
  });

  test("a disabled envelope takes no keys and no tab stop", () => {
    const { changes, point } = renderEnvelope(
      `default-value="${POINTS}" disabled`
    );
    expect(point(0).tabIndex).toBe(-1);
    expect(point(0).getAttribute("aria-disabled")).toBe("true");
    key(point(1), "ArrowUp");
    key(point(1), "Delete");
    expect(changes).toHaveLength(0);
  });
});

describe("the envelope's pointer", () => {
  test("dragging a point updates live and commits on release", () => {
    const { changes, commits, point, root } = renderEnvelope();
    pointer(point(1), "pointerdown", { clientX: 40, clientY: 0, pointerId: 1 });
    expect(point(1).hasAttribute("data-dragging")).toBe(true);
    expect(root.hasAttribute("data-dragging")).toBe(true);
    pointer(point(1), "pointermove", {
      clientX: 80,
      clientY: 25,
      pointerId: 1,
    });
    expect(changes.at(-1)?.[0][1]).toEqual({ x: 0.4, y: 0.75 });
    expect(changes.at(-1)?.[1]).toBe("drag");
    expect(commits).toHaveLength(0);
    pointer(point(1), "pointerup", { clientX: 80, clientY: 25, pointerId: 1 });
    expect(commits.at(-1)?.[0][1]).toEqual({ x: 0.4, y: 0.75 });
    expect(point(1).hasAttribute("data-dragging")).toBe(false);
  });

  test("points set from outside follow the drag, and preventDefault() refuses a move", () => {
    const { point, root } = renderEnvelope(`value="${POINTS}"`);
    pointer(point(1), "pointerdown", { clientX: 40, clientY: 0, pointerId: 1 });
    pointer(point(1), "pointermove", {
      clientX: 80,
      clientY: 25,
      pointerId: 1,
    });
    pointer(point(1), "pointerup", { clientX: 80, clientY: 25, pointerId: 1 });
    expect(point(1).style.left).toBe("40%");
    // Read again from the attributes, the envelope keeps the moved points.
    root.setAttribute("step", "0.02");
    expect(point(1).style.left).toBe("40%");

    root.addEventListener("input", (event) => event.preventDefault());
    pointer(point(1), "pointerdown", {
      clientX: 80,
      clientY: 25,
      pointerId: 2,
    });
    pointer(point(1), "pointermove", {
      clientX: 100,
      clientY: 50,
      pointerId: 2,
    });
    expect(point(1).style.left).toBe("40%");
  });

  test("snap puts a dragged point on the grid, one step for each axis", () => {
    const { changes, point } = renderEnvelope(
      `default-value="${POINTS}" snap="0.25 0"`
    );
    pointer(point(1), "pointerdown", { clientX: 40, clientY: 0, pointerId: 1 });
    pointer(point(1), "pointermove", {
      clientX: 74,
      clientY: 38,
      pointerId: 1,
    });
    expect(changes.at(-1)?.[0][1]?.x).toBe(0.25);
    expect(changes.at(-1)?.[0][1]?.y).toBeCloseTo(0.62, 5);
  });

  test("Alt + click and a double click remove a point", () => {
    const { changes, point, points } = renderEnvelope();
    pointer(point(1), "pointerdown", { altKey: true, pointerId: 1 });
    expect(points()).toHaveLength(3);
    doubleClick(point(1));
    expect(points()).toHaveLength(2);
    expect(changes.map(([, reason]) => reason)).toEqual(["remove", "remove"]);
  });

  test("a double click on the graph adds a point there, the new tab stop; at max-points it is refused", async () => {
    const { changes, graph, point, points } = renderEnvelope(
      `default-value="${POINTS}" max-points="5"`
    );
    doubleClick(graph, { clientX: 100, clientY: 20 });
    expect(points()).toHaveLength(5);
    expect(changes.at(-1)?.[0][2]).toEqual({ x: 0.5, y: 0.8 });
    expect(changes.at(-1)?.[1]).toBe("add");
    expect(point(2).tabIndex).toBe(0);
    doubleClick(graph, { clientX: 180, clientY: 50 });
    expect(points()).toHaveLength(5);
    await nextFrame();
    expect(graph.hasAttribute("data-blocked")).toBe(true);
  });

  test("a disabled envelope ignores the pointer", () => {
    const { changes, point } = renderEnvelope(
      `default-value="${POINTS}" disabled`
    );
    pointer(point(1), "pointerdown", { clientX: 40, clientY: 0, pointerId: 1 });
    pointer(point(1), "pointermove", {
      clientX: 80,
      clientY: 25,
      pointerId: 1,
    });
    expect(changes).toHaveLength(0);
  });
});

describe("the envelope's segments", () => {
  test("one handle per segment, on its midpoint, a slider on the curve", () => {
    const { segment } = renderEnvelope();
    expect(document.querySelectorAll("audio-ui-envelope-segment")).toHaveLength(
      3
    );
    expect(segment(0).style.left).toBe("10%");
    expect(segment(0).style.bottom).toBe("50%");
    expect(segment(0).getAttribute("aria-label")).toBe("Curve 1");
    expect(segment(0).getAttribute("aria-valuenow")).toBe("0");
  });

  test("dragging a handle bends the segment and commits a curve", () => {
    const { changes, commits, segment } = renderEnvelope();
    pointer(segment(0), "pointerdown", {
      clientX: 20,
      clientY: 50,
      pointerId: 1,
    });
    expect(segment(0).hasAttribute("data-dragging")).toBe(true);
    pointer(segment(0), "pointermove", {
      clientX: 20,
      clientY: 75,
      pointerId: 1,
    });
    expect(changes.at(-1)?.[0][0]?.curve).toBeGreaterThan(0);
    expect(changes.at(-1)?.[1]).toBe("curve");
    pointer(segment(0), "pointerup", {
      clientX: 20,
      clientY: 75,
      pointerId: 1,
    });
    expect(commits.at(-1)?.[1]).toBe("curve");
    expect(Number.parseFloat(segment(0).style.bottom)).toBeLessThan(50);
  });

  test("Up and Down bend it, Left and Right rove the tab stop, a double click straightens it", () => {
    const { changes, segment } = renderEnvelope();
    expect(segment(0).tabIndex).toBe(0);
    key(segment(0), "ArrowUp");
    expect(changes.at(-1)?.[0][0]?.curve).toBeCloseTo(-0.05, 5);
    segment(0).focus();
    key(segment(0), "ArrowRight");
    expect(document.activeElement).toBe(segment(1));
    expect(segment(0).tabIndex).toBe(-1);
    key(segment(1), "ArrowRight");
    key(segment(2), "ArrowRight");
    expect(document.activeElement).toBe(segment(2));
    doubleClick(segment(0));
    expect(changes.at(-1)?.[0][0]).toEqual({ x: 0, y: 0 });
  });

  test("a segment between two points of one level has nothing to bend", () => {
    const { changes, segment } = renderEnvelope('default-value="0 0.5, 1 0.5"');
    expect(segment(0).hasAttribute("data-flat")).toBe(true);
    expect(segment(0).getAttribute("aria-disabled")).toBe("true");
    pointer(segment(0), "pointerdown", {
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    pointer(segment(0), "pointermove", {
      clientX: 100,
      clientY: 80,
      pointerId: 1,
    });
    key(segment(0), "ArrowUp");
    expect(changes).toHaveLength(0);
  });

  test("Alt + drag on the graph bends the segment under the pointer", () => {
    const { changes, commits, graph } = renderEnvelope();
    pointer(graph, "pointerdown", {
      altKey: true,
      clientX: 20,
      clientY: 50,
      pointerId: 1,
    });
    pointer(graph, "pointermove", {
      altKey: true,
      clientX: 20,
      clientY: 80,
      pointerId: 1,
    });
    expect(changes.at(-1)?.[1]).toBe("curve");
    expect(changes.at(-1)?.[0][0]?.curve).toBeGreaterThan(0);
    pointer(graph, "pointerup", { clientX: 20, clientY: 80, pointerId: 1 });
    expect(commits.at(-1)?.[1]).toBe("curve");
  });

  test("the handles follow the number of points", () => {
    const { graph } = renderEnvelope();
    doubleClick(graph, { clientX: 100, clientY: 20 });
    expect(document.querySelectorAll("audio-ui-envelope-segment")).toHaveLength(
      4
    );
  });
});
