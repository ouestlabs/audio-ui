import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { Envelope } from "../envelope";

const POINTS: Envelope.Breakpoint[] = [
  { x: 0, y: 0 },
  { x: 0.2, y: 1 },
  { x: 0.6, y: 0.5 },
  { x: 1, y: 0 },
];

function renderEnvelope(props: Envelope.Root.Props = {}) {
  const onValueChange = mock(
    (
      _value: Envelope.Breakpoint[],
      _details: Envelope.Root.ChangeEventDetails
    ) => undefined
  );
  const onValueCommitted = mock(
    (
      _value: Envelope.Breakpoint[],
      _details: Envelope.Root.CommitEventDetails
    ) => undefined
  );
  const view = render(
    <Envelope.Root
      defaultValue={POINTS}
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      {...props}
    >
      <Envelope.Graph data-testid="graph">
        <Envelope.Line data-testid="line" />
      </Envelope.Graph>
      <Envelope.Points>
        {(_point, index) => (
          <Envelope.Point
            aria-label={`Point ${index + 1}`}
            index={index}
            key={index}
          />
        )}
      </Envelope.Points>
      <Envelope.Segments>
        {(_point, index) => (
          <Envelope.Segment
            aria-label={`Curve ${index + 1}`}
            index={index}
            key={index}
          />
        )}
      </Envelope.Segments>
    </Envelope.Root>
  );
  mockRect(view.getByTestId("graph"), {
    bottom: 100,
    height: 100,
    right: 200,
    width: 200,
  });
  return {
    onValueChange,
    onValueCommitted,
    point: (index: number) => view.getByLabelText(`Point ${index + 1}`),
    segment: (index: number) => view.getByLabelText(`Curve ${index + 1}`),
    view,
  };
}

const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;

const coordinateCount = (line: HTMLElement) =>
  (line.getAttribute("points") ?? "").split(" ").length;

describe("Envelope segments", () => {
  test("renders one handle per segment, between the points", () => {
    const { segment } = renderEnvelope();
    // A straight segment's midpoint is halfway along it.
    expect(segment(0).style.left).toBe("10%");
    expect(segment(0).style.bottom).toBe("50%");
    expect(segment(0).getAttribute("aria-valuenow")).toBe("0");
  });

  test("a bent segment is drawn as a curve, and its handle follows the curve's midpoint", () => {
    const straight = renderEnvelope();
    const straightCount = coordinateCount(straight.view.getByTestId("line"));
    straight.view.unmount();

    const bent = renderEnvelope({
      value: POINTS.map((point, index) =>
        index === 0 ? { ...point, curve: 0.5 } : point
      ),
    });
    expect(coordinateCount(bent.view.getByTestId("line"))).toBeGreaterThan(
      straightCount
    );
    // A positive curve holds the start of a rise: its midpoint sits below the straight line's.
    expect(Number.parseFloat(bent.segment(0).style.bottom)).toBeLessThan(50);
  });

  test("dragging a handle bends the segment so its midpoint follows the pointer", () => {
    const { segment, onValueChange, onValueCommitted } = renderEnvelope();
    fireEvent.pointerDown(segment(0), {
      clientX: 20,
      clientY: 50,
      pointerId: 1,
    });
    expect(segment(0).hasAttribute("data-dragging")).toBe(true);
    // The pointer a quarter of the way up: the midpoint's share of the rise is 0.25, an exponent of 2.
    fireEvent.pointerMove(segment(0), {
      clientX: 20,
      clientY: 75,
      pointerId: 1,
    });
    const [value, details] = lastCall(onValueChange);
    expect(value[0]?.curve).toBeCloseTo(1 / 3, 3);
    expect(details.reason).toBe("curve");
    expect(onValueCommitted).not.toHaveBeenCalled();

    fireEvent.pointerUp(segment(0), { clientX: 20, clientY: 75, pointerId: 1 });
    expect(lastCall(onValueCommitted)[0][0]?.curve).toBeCloseTo(1 / 3, 3);
    expect(lastCall(onValueCommitted)[1].reason).toBe("curve");
    expect(segment(0).hasAttribute("data-dragging")).toBe(false);
  });

  test("the arrow keys bend it: up lifts the handle, so a rising segment gets a negative curve", () => {
    const { segment, onValueChange, onValueCommitted } = renderEnvelope();
    fireEvent.keyDown(segment(0), { key: "ArrowUp" });
    expect(lastCall(onValueChange)[0][0]?.curve).toBeCloseTo(-0.05, 5);
    expect(lastCall(onValueCommitted)[1].reason).toBe("curve");
    // The falling segment bends the other way for the same key.
    fireEvent.keyDown(segment(2), { key: "ArrowUp" });
    expect(lastCall(onValueChange)[0][2]?.curve).toBeCloseTo(0.05, 5);
  });

  test("Shift takes larger steps, and the curve stops at -1…1", () => {
    const { segment, onValueChange } = renderEnvelope({
      defaultValue: [
        { curve: 0.9, x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    fireEvent.keyDown(segment(0), { key: "ArrowDown", shiftKey: true });
    expect(lastCall(onValueChange)[0][0]?.curve).toBe(1);
  });

  test("a double click straightens the segment and drops its curve", () => {
    const { segment, onValueChange } = renderEnvelope({
      defaultValue: POINTS.map((point, index) =>
        index === 1 ? { ...point, curve: -0.4 } : point
      ),
    });
    fireEvent.doubleClick(segment(1));
    const [value, details] = lastCall(onValueChange);
    expect(value[1]).toEqual({ x: 0.2, y: 1 });
    expect(details.reason).toBe("curve");
  });

  test("a segment between two points of one level has nothing to bend", () => {
    const { segment, onValueChange } = renderEnvelope({
      defaultValue: [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
      ],
    });
    expect(segment(0).hasAttribute("data-flat")).toBe(true);
    fireEvent.pointerDown(segment(0), {
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(segment(0), {
      clientX: 100,
      clientY: 80,
      pointerId: 1,
    });
    fireEvent.keyDown(segment(0), { key: "ArrowUp" });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("moving a point keeps its segment's curve", () => {
    const { point, onValueChange } = renderEnvelope({
      defaultValue: POINTS.map((p, index) =>
        index === 1 ? { ...p, curve: 0.3 } : p
      ),
    });
    fireEvent.pointerDown(point(1), { clientX: 40, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(point(1), { clientX: 60, clientY: 10, pointerId: 1 });
    expect(lastCall(onValueChange)[0][1]).toEqual({
      curve: 0.3,
      x: 0.3,
      y: 0.9,
    });
  });

  test("clamps a curve given out of range and drops one that is nearly flat", () => {
    const { segment } = renderEnvelope({
      value: [
        { curve: 4, x: 0, y: 0 },
        { curve: 0.001, x: 0.5, y: 1 },
        { x: 1, y: 0 },
      ],
    });
    expect(segment(0).getAttribute("aria-valuenow")).toBe("1");
    expect(segment(1).getAttribute("aria-valuenow")).toBe("0");
  });
});

describe("Envelope fine drag", () => {
  test("with Shift a point follows a quarter of the pointer's travel", () => {
    const { point, onValueChange } = renderEnvelope();
    fireEvent.pointerDown(point(1), { clientX: 40, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(point(1), {
      clientX: 80,
      clientY: 0,
      pointerId: 1,
      shiftKey: true,
    });
    // The first fine move only anchors: the point does not jump.
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(point(1), {
      clientX: 120,
      clientY: 0,
      pointerId: 1,
      shiftKey: true,
    });
    expect(lastCall(onValueChange)[0][1]?.x).toBeCloseTo(0.25, 5);
  });
});
