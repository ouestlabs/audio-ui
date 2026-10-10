import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers";
import { Envelope } from "../../../entries/envelope";
import type { Point } from "../../../utils";

/** 4 points: {0,0} {0.2,1} {0.6,0.5} {1,0}, so paint/keyboard assertions stay exact. Passed explicitly rather than relying on Root's own default, which is chosen for how it looks in a demo, not for round test numbers. */
const TEST_POINTS = [
  { x: 0, y: 0 },
  { x: 0.2, y: 1 },
  { x: 0.6, y: 0.5 },
  { x: 1, y: 0 },
];

const TWO_POINTS = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

function renderEnvelope(props: Envelope.Root.Props = {}) {
  const onValueChange = mock(
    (_value: Point[], _details: Envelope.Root.ChangeEventDetails) => undefined
  );
  const onValueCommitted = mock(
    (_value: Point[], _details: Envelope.Root.CommitEventDetails) => undefined
  );
  const view = render(
    <Envelope.Root
      defaultValue={TEST_POINTS}
      locale="en-US"
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      {...props}
    >
      <Envelope.Graph data-testid="graph">
        <Envelope.Fill data-testid="fill" />
        <Envelope.Line data-testid="line" />
      </Envelope.Graph>
      <Envelope.Points>
        {(_point, index, points) => (
          <Envelope.Point
            aria-label={`Point ${index + 1} of ${points.length}`}
            index={index}
            key={index}
          />
        )}
      </Envelope.Points>
    </Envelope.Root>
  );
  const graph = view.getByTestId("graph");
  // a 200×100 graph at the origin
  mockRect(graph, { bottom: 100, height: 100, right: 200, width: 200 });
  return {
    graph,
    onValueChange,
    onValueCommitted,
    point: (index: number) => view.getAllByRole("slider")[index] as HTMLElement,
    points: () => view.getAllByRole("slider"),
    view,
  };
}

const secondsAndPercent = (p: Point) => `${p.x * 2} s, ${p.y * 100}%`;

const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;

describe("Envelope parts", () => {
  test("forward className to the Graph, Line, Fill and Point elements", () => {
    const view = render(
      <Envelope.Root>
        <Envelope.Graph className="graph-class" data-testid="graph">
          <Envelope.Fill className="fill-class" data-testid="fill" />
          <Envelope.Line className="line-class" data-testid="line" />
        </Envelope.Graph>
        <Envelope.Points>
          {(_point, index) => (
            <Envelope.Point
              className="point-class"
              data-testid={`point-${index}`}
              index={index}
              key={index}
            />
          )}
        </Envelope.Points>
      </Envelope.Root>
    );
    expect(view.getByTestId("graph").getAttribute("class")).toBe("graph-class");
    expect(view.getByTestId("line").getAttribute("class")).toBe("line-class");
    expect(view.getByTestId("fill").getAttribute("class")).toBe("fill-class");
    expect(view.getByTestId("point-0").getAttribute("class")).toBe(
      "point-class"
    );
  });

  test("the graph is decorative and points carry only the names they are given", () => {
    const { graph, point } = renderEnvelope();
    expect(graph.getAttribute("aria-hidden")).toBe("true");
    expect(point(1).getAttribute("aria-label")).toBe("Point 2 of 4");
    expect(point(1).getAttribute("aria-valuenow")).toBe("1");
  });
});

describe("Envelope Root's own default (no value/defaultValue passed)", () => {
  test("renders an ADSR-shaped default with a sustain plateau, not a bare triangle touching 0", () => {
    const { points } = renderEnvelope({ defaultValue: undefined });
    const texts = points().map((p) => p.getAttribute("aria-valuetext"));
    expect(texts).toEqual([
      "0, 0.05",
      "0.15, 1",
      "0.35, 0.6",
      "0.7, 0.6",
      "1, 0.05",
    ]);
  });
});

describe("Envelope value semantics", () => {
  test("renders one point per value entry, sorted by x", () => {
    const { points } = renderEnvelope({
      value: [
        { x: 1, y: 0 },
        { x: 0, y: 0.5 },
      ],
    });
    expect(points().map((p) => p.getAttribute("aria-valuetext"))).toEqual([
      "0, 0.5",
      "1, 0",
    ]);
  });

  test("joins x and y with a semicolon where the decimal mark is a comma", () => {
    const { points } = renderEnvelope({
      locale: "fr-FR",
      value: [
        { x: 0.25, y: 0.5 },
        { x: 1, y: 0 },
      ],
    });
    expect(points().map((p) => p.getAttribute("aria-valuetext"))).toEqual([
      "0,25; 0,5",
      "1; 0",
    ]);
  });

  test("getAriaValueText maps the normalized point to real units", () => {
    const view = render(
      <Envelope.Root defaultValue={TWO_POINTS}>
        <Envelope.Points>
          {(_point, index) => (
            <Envelope.Point
              getAriaValueText={secondsAndPercent}
              index={index}
              key={index}
            />
          )}
        </Envelope.Points>
      </Envelope.Root>
    );
    expect(view.getAllByRole("slider")[1]?.getAttribute("aria-valuetext")).toBe(
      "2 s, 100%"
    );
  });

  test("positions each point via left/bottom percentage, decoupled from the Graph's own coordinate space", () => {
    const { point } = renderEnvelope();
    expect(point(1).style.left).toBe("20%");
    expect(point(1).style.bottom).toBe("100%"); // y=1
    expect(point(0).style.bottom).toBe("0%"); // y=0
  });

  test("draws the line with flat lead-in/out to the container edges", () => {
    const { view } = renderEnvelope();
    expect(view.getByTestId("line").getAttribute("points")).toBe(
      "0,100 0,100 20,0 60,50 100,100 100,100"
    );
  });

  test("draws the fill as the line closed down to the bottom corners", () => {
    const { view } = renderEnvelope();
    expect(view.getByTestId("fill").getAttribute("points")).toBe(
      "0,100 0,100 20,0 60,50 100,100 100,100 100,100 0,100"
    );
  });

  test("only one point at a time is a tab stop", () => {
    const { points, point } = renderEnvelope();
    expect(points().map((p) => p.tabIndex)).toEqual([0, -1, -1, -1]);
    fireEvent.focus(point(2));
    expect(points().map((p) => p.tabIndex)).toEqual([-1, -1, 0, -1]);
  });
});

describe("Envelope keyboard", () => {
  test("arrow keys move the focused point and commit, with a keyboard reason and the point's index", () => {
    const { point, onValueChange, onValueCommitted } = renderEnvelope();
    fireEvent.keyDown(point(2), { key: "ArrowUp" });
    const [value, details] = lastCall(onValueChange);
    expect(value[2]).toEqual({ x: 0.6, y: 0.51 });
    expect(details.reason).toBe("keyboard");
    expect(details.index).toBe(2);
    expect(lastCall(onValueCommitted)[0][2]).toEqual({ x: 0.6, y: 0.51 });
  });

  test("Shift + arrow moves ten steps", () => {
    const { point, onValueChange } = renderEnvelope();
    fireEvent.keyDown(point(2), { key: "ArrowDown", shiftKey: true });
    expect(lastCall(onValueChange)[0][2]).toEqual({ x: 0.6, y: 0.4 });
  });

  test("clamps x against neighboring points, never crossing them", () => {
    const { point, onValueCommitted } = renderEnvelope();
    for (let i = 0; i < 50; i += 1) {
      fireEvent.keyDown(point(2), { key: "ArrowRight" });
    }
    expect(lastCall(onValueCommitted)[0][2]?.x).toBe(1); // the next point's x
  });

  test("clamps y to [0,1]", () => {
    const { point, onValueCommitted } = renderEnvelope();
    for (let i = 0; i < 60; i += 1) {
      fireEvent.keyDown(point(2), { key: "ArrowUp" });
    }
    expect(lastCall(onValueCommitted)[0][2]?.y).toBe(1);
  });

  test("Delete removes the focused point when above minPoints, with a remove reason", () => {
    const { point, onValueCommitted } = renderEnvelope();
    fireEvent.keyDown(point(1), { key: "Delete" });
    const [value, details] = lastCall(onValueCommitted);
    expect(value).toEqual([
      { x: 0, y: 0 },
      { x: 0.6, y: 0.5 },
      { x: 1, y: 0 },
    ]);
    expect(details.reason).toBe("remove");
  });

  test("Backspace removes the focused point", () => {
    const { point, onValueCommitted } = renderEnvelope();
    fireEvent.keyDown(point(1), { key: "Backspace" });
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });

  test("blocks removal at minPoints", () => {
    const { point, onValueCommitted } = renderEnvelope({ value: TWO_POINTS });
    fireEvent.keyDown(point(0), { key: "Delete" });
    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(point(0).hasAttribute("data-removable")).toBe(false);
  });

  test("ignores keys when disabled", () => {
    const { point, onValueCommitted } = renderEnvelope({ disabled: true });
    fireEvent.keyDown(point(1), { key: "ArrowUp" });
    fireEvent.keyDown(point(1), { key: "Delete" });
    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(point(1).tabIndex).toBe(-1);
  });
});

describe("Envelope pointer drag (graph 200×100)", () => {
  test("dragging a point updates live and commits on release", () => {
    const { point, onValueChange, onValueCommitted } = renderEnvelope();

    fireEvent.pointerDown(point(1), { clientX: 40, clientY: 0, pointerId: 1 });
    expect(point(1).hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerMove(point(1), { clientX: 80, clientY: 25, pointerId: 1 });
    const [value, details] = lastCall(onValueChange);
    expect(value[1]).toEqual({ x: 0.4, y: 0.75 });
    expect(details.reason).toBe("drag");
    expect(onValueCommitted).not.toHaveBeenCalled();

    fireEvent.pointerUp(point(1), { clientX: 80, clientY: 25, pointerId: 1 });
    expect(lastCall(onValueCommitted)[0][1]).toEqual({ x: 0.4, y: 0.75 });
    expect(point(1).hasAttribute("data-dragging")).toBe(false);
  });

  test("clamps a dragged point's x between its neighbors", () => {
    const { point, onValueChange } = renderEnvelope();
    fireEvent.pointerDown(point(1), { clientX: 40, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(point(1), { clientX: 190, clientY: 0, pointerId: 1 });
    expect(lastCall(onValueChange)[0][1]?.x).toBe(0.6); // the next point's x
  });

  test("a controlled value that lags behind doesn't pull the point back mid-drag", () => {
    const { point } = renderEnvelope({ value: TEST_POINTS });
    fireEvent.pointerDown(point(1), { clientX: 40, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(point(1), { clientX: 80, clientY: 25, pointerId: 1 });
    expect(point(1).style.left).toBe("40%");
    fireEvent.pointerUp(point(1), { clientX: 80, clientY: 25, pointerId: 1 });
    expect(point(1).style.left).toBe("20%");
  });

  test("eventDetails.cancel() rejects a move", () => {
    const { point } = renderEnvelope({
      onValueChange: (_value, details) => details.cancel(),
    });
    fireEvent.pointerDown(point(1), { clientX: 40, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(point(1), { clientX: 80, clientY: 25, pointerId: 1 });
    expect(point(1).style.left).toBe("20%");
  });

  test("ignores pointer input when disabled", () => {
    const { point, onValueChange } = renderEnvelope({ disabled: true });
    fireEvent.pointerDown(point(1), { clientX: 40, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(point(1), { clientX: 80, clientY: 25, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Envelope alt-click remove", () => {
  test("Alt + click on a point removes it, with a remove reason", () => {
    const { onValueChange, point } = renderEnvelope();
    fireEvent.pointerDown(point(1), { altKey: true, button: 0, pointerId: 1 });
    const [value, details] = lastCall(onValueChange);
    expect(value).toHaveLength(3);
    expect(details.reason).toBe("remove");
  });

  test("it is refused at minPoints, like any removal", () => {
    const { onValueChange, point } = renderEnvelope({
      defaultValue: TWO_POINTS,
    });
    fireEvent.pointerDown(point(0), { altKey: true, button: 0, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Envelope double-click add/remove", () => {
  test("double-clicking empty graph space adds a point there, with an add reason", () => {
    const { graph, onValueCommitted } = renderEnvelope();
    fireEvent.doubleClick(graph, { clientX: 100, clientY: 25 });
    const [value, details] = lastCall(onValueCommitted);
    expect(value).toHaveLength(5);
    expect(value[2]).toEqual({ x: 0.5, y: 0.75 });
    expect(details.reason).toBe("add");
    expect(details.index).toBe(2);
  });

  test("does not add a point at maxPoints", () => {
    const { graph, onValueCommitted } = renderEnvelope({ maxPoints: 4 });
    fireEvent.doubleClick(graph, { clientX: 100, clientY: 25 });
    expect(onValueCommitted).not.toHaveBeenCalled();
  });

  test("double-clicking a point removes it", () => {
    const { point, onValueCommitted } = renderEnvelope();
    fireEvent.doubleClick(point(1));
    expect(lastCall(onValueCommitted)[0]).toEqual([
      { x: 0, y: 0 },
      { x: 0.6, y: 0.5 },
      { x: 1, y: 0 },
    ]);
  });

  test("minPoints equal to maxPoints fixes the shape: no add, no remove, still draggable", () => {
    const { graph, point, onValueChange, onValueCommitted } = renderEnvelope({
      maxPoints: 4,
      minPoints: 4,
    });
    fireEvent.doubleClick(graph, { clientX: 100, clientY: 25 });
    fireEvent.doubleClick(point(1));
    expect(onValueCommitted).not.toHaveBeenCalled();

    fireEvent.keyDown(point(2), { key: "ArrowUp" });
    expect(lastCall(onValueChange)[0]).toHaveLength(4);
  });

  test("blocks removal at minPoints via double-click", () => {
    const { point, onValueCommitted } = renderEnvelope({ value: TWO_POINTS });
    fireEvent.doubleClick(point(0));
    expect(onValueCommitted).not.toHaveBeenCalled();
  });
});
