import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { Envelope } from "../envelope";

/** 4 points: {0,0} {0.2,1} {0.6,0.5} {1,0}, so paint/keyboard assertions stay exact. Passed explicitly rather than relying on Root's own default, which is chosen for how it looks in a demo, not for round test numbers. */
const TEST_POINTS = [
  { x: 0, y: 0 },
  { x: 0.2, y: 1 },
  { x: 0.6, y: 0.5 },
  { x: 1, y: 0 },
];

function renderEnvelope(props: Partial<Envelope.RootProps> = {}) {
  const onValueChange = mock(() => undefined);
  const onValueCommit = mock(() => undefined);
  const view = render(
    <Envelope.Root
      defaultValue={TEST_POINTS}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      {...props}
    >
      <Envelope.Svg data-testid="svg">
        <Envelope.Fill data-testid="fill" />
        <Envelope.Path data-testid="path" />
      </Envelope.Svg>
      <Envelope.Points>
        {(_point, index) => (
          <Envelope.Point
            data-testid={`point-${index}`}
            index={index}
            key={index}
          />
        )}
      </Envelope.Points>
    </Envelope.Root>
  );
  return {
    onValueChange,
    onValueCommit,
    points: view.getAllByRole("slider"),
    svg: view.getByTestId("svg"),
    view,
  };
}

describe("Envelope prop forwarding", () => {
  test("applies className to the Svg, Path, Fill, and Point elements", () => {
    const view = render(
      <Envelope.Root>
        <Envelope.Svg className="svg-test-class" data-testid="svg">
          <Envelope.Fill className="fill-test-class" data-testid="fill" />
          <Envelope.Path className="path-test-class" data-testid="path" />
        </Envelope.Svg>
        <Envelope.Points>
          {(_point, index) => (
            <Envelope.Point
              className="point-test-class"
              data-testid={`point-${index}`}
              index={index}
              key={index}
            />
          )}
        </Envelope.Points>
      </Envelope.Root>
    );
    expect(view.getByTestId("svg").getAttribute("class")).toBe(
      "svg-test-class"
    );
    expect(view.getByTestId("path").getAttribute("class")).toBe(
      "path-test-class"
    );
    expect(view.getByTestId("fill").getAttribute("class")).toBe(
      "fill-test-class"
    );
    expect(view.getByTestId("point-0").getAttribute("class")).toBe(
      "point-test-class"
    );
  });
});

describe("Envelope Root's own default (no value/defaultValue passed)", () => {
  test("renders an ADSR-shaped default with a sustain plateau, not a bare triangle touching 0", () => {
    const view = render(
      <Envelope.Root>
        <Envelope.Points>
          {(_point, index) => (
            <Envelope.Point
              data-testid={`default-point-${index}`}
              index={index}
              key={index}
            />
          )}
        </Envelope.Points>
      </Envelope.Root>
    );
    const points = view.getAllByRole("slider");
    expect(points).toHaveLength(5);
    expect(points[0]?.getAttribute("aria-valuetext")).toBe("x: 0.00, y: 0.05");
    expect(points.at(-1)?.getAttribute("aria-valuetext")).toBe(
      "x: 1.00, y: 0.05"
    );
    // sustain plateau: two interior points at the same y
    expect(points[2]?.getAttribute("aria-valuetext")).toBe("x: 0.35, y: 0.60");
    expect(points[3]?.getAttribute("aria-valuetext")).toBe("x: 0.70, y: 0.60");
  });
});

describe("Envelope value semantics", () => {
  test("renders one point per default value entry, sorted by x", () => {
    const { points } = renderEnvelope();
    expect(points).toHaveLength(4);
    expect(points[0]?.getAttribute("aria-valuetext")).toBe("x: 0.00, y: 0.00");
    expect(points[1]?.getAttribute("aria-valuetext")).toBe("x: 0.20, y: 1.00");
  });

  test("sorts an out-of-order controlled value by x", () => {
    const { points } = renderEnvelope({
      value: [
        { x: 1, y: 0 },
        { x: 0, y: 0.5 },
      ],
    });
    expect(points[0]?.getAttribute("aria-valuetext")).toBe("x: 0.00, y: 0.50");
    expect(points[1]?.getAttribute("aria-valuetext")).toBe("x: 1.00, y: 0.00");
  });

  test("positions each point via left/bottom percentage, decoupled from the Svg's own coordinate space", () => {
    const { points } = renderEnvelope();
    expect((points[1] as HTMLElement).style.left).toBe("20%");
    expect((points[1] as HTMLElement).style.bottom).toBe("100%"); // y=1
    expect((points[0] as HTMLElement).style.bottom).toBe("0%"); // y=0
  });

  test("draws the path with flat lead-in/out to the container edges", () => {
    const { view } = renderEnvelope();
    expect(view.getByTestId("path").getAttribute("points")).toBe(
      "0,100 0,100 20,0 60,50 100,100 100,100"
    );
  });

  test("draws the fill as the path closed down to the bottom corners", () => {
    const { view } = renderEnvelope();
    expect(view.getByTestId("fill").getAttribute("points")).toBe(
      "0,100 0,100 20,0 60,50 100,100 100,100 100,100 0,100"
    );
  });
});

describe("Envelope keyboard", () => {
  test("Arrow keys adjust the focused point and commit", () => {
    const { points, onValueCommit } = renderEnvelope();
    fireEvent.keyDown(points[2] as HTMLElement, { key: "ArrowUp" });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      { x: 0, y: 0 },
      { x: 0.2, y: 1 },
      { x: 0.6, y: 0.51 },
      { x: 1, y: 0 },
    ]);
  });

  test("clamps x against neighboring points, never crossing them", () => {
    const { points, onValueCommit } = renderEnvelope();
    for (let i = 0; i < 50; i += 1) {
      fireEvent.keyDown(points[2] as HTMLElement, { key: "ArrowRight" });
    }
    const lastCall = onValueCommit.mock.calls.at(-1)?.[0];
    expect(lastCall?.[2]?.x).toBe(1); // clamped to the next point's x
  });

  test("clamps y to [0,1]", () => {
    const { points, onValueCommit } = renderEnvelope();
    for (let i = 0; i < 60; i += 1) {
      fireEvent.keyDown(points[2] as HTMLElement, { key: "ArrowUp" });
    }
    const lastCall = onValueCommit.mock.calls.at(-1)?.[0];
    expect(lastCall?.[2]?.y).toBe(1);
  });

  test("Delete removes the focused point when above minPoints", () => {
    const { points, onValueCommit } = renderEnvelope();
    fireEvent.keyDown(points[1] as HTMLElement, { key: "Delete" });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      { x: 0, y: 0 },
      { x: 0.6, y: 0.5 },
      { x: 1, y: 0 },
    ]);
  });

  test("Backspace removes the focused point", () => {
    const { points, onValueCommit } = renderEnvelope();
    fireEvent.keyDown(points[1] as HTMLElement, { key: "Backspace" });
    expect(onValueCommit).toHaveBeenCalledTimes(1);
  });

  test("blocks removal at minPoints", () => {
    const { points, onValueCommit } = renderEnvelope({
      value: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    fireEvent.keyDown(points[0] as HTMLElement, { key: "Delete" });
    expect(onValueCommit).not.toHaveBeenCalled();
  });

  test("ignores keys when disabled", () => {
    const { points, onValueCommit } = renderEnvelope({ disabled: true });
    fireEvent.keyDown(points[1] as HTMLElement, { key: "ArrowUp" });
    fireEvent.keyDown(points[1] as HTMLElement, { key: "Delete" });
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(points[1]?.tabIndex).toBe(-1);
  });
});

describe("Envelope pointer drag (svg 200×100)", () => {
  test("dragging a point updates live and commits on release", () => {
    const { svg, points, onValueChange, onValueCommit } = renderEnvelope();
    mockRect(svg, { height: 100, width: 200 });

    fireEvent.pointerDown(points[1] as HTMLElement, {
      clientX: 40,
      clientY: 0,
      pointerId: 1,
    });
    fireEvent.pointerMove(points[1] as HTMLElement, {
      clientX: 80,
      clientY: 25,
      pointerId: 1,
    });
    expect(onValueChange).toHaveBeenLastCalledWith([
      { x: 0, y: 0 },
      { x: 0.4, y: 0.75 },
      { x: 0.6, y: 0.5 },
      { x: 1, y: 0 },
    ]);
    expect(onValueCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(points[1] as HTMLElement, {
      clientX: 80,
      clientY: 25,
      pointerId: 1,
    });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      { x: 0, y: 0 },
      { x: 0.4, y: 0.75 },
      { x: 0.6, y: 0.5 },
      { x: 1, y: 0 },
    ]);
  });

  test("clamps a dragged point's x between its neighbors", () => {
    const { svg, points, onValueChange } = renderEnvelope();
    mockRect(svg, { height: 100, width: 200 });

    fireEvent.pointerDown(points[1] as HTMLElement, {
      clientX: 40,
      clientY: 0,
      pointerId: 1,
    });
    fireEvent.pointerMove(points[1] as HTMLElement, {
      clientX: 190,
      clientY: 0,
      pointerId: 1,
    });
    const values = onValueChange.mock.calls.at(-1)?.[0];
    expect(values?.[1]?.x).toBe(0.6); // clamped to next point (index 2)'s x
  });

  test("ignores pointer input when disabled", () => {
    const { svg, points, onValueChange } = renderEnvelope({ disabled: true });
    mockRect(svg, { height: 100, width: 200 });

    fireEvent.pointerDown(points[1] as HTMLElement, {
      clientX: 40,
      clientY: 0,
      pointerId: 1,
    });
    fireEvent.pointerMove(points[1] as HTMLElement, {
      clientX: 80,
      clientY: 25,
      pointerId: 1,
    });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Envelope double-click add/remove", () => {
  test("double-clicking empty svg space adds a point there", () => {
    const { svg, onValueCommit } = renderEnvelope();
    mockRect(svg, { height: 100, width: 200 });

    fireEvent.doubleClick(svg, { clientX: 100, clientY: 25 });
    const values = onValueCommit.mock.calls.at(-1)?.[0];
    expect(values).toHaveLength(5);
    expect(values).toContainEqual({ x: 0.5, y: 0.75 });
  });

  test("does not add a point when allowAddPoints is false", () => {
    const { svg, onValueCommit } = renderEnvelope({ allowAddPoints: false });
    mockRect(svg, { height: 100, width: 200 });

    fireEvent.doubleClick(svg, { clientX: 100, clientY: 25 });
    expect(onValueCommit).not.toHaveBeenCalled();
  });

  test("double-clicking a point removes it", () => {
    const { points, onValueCommit } = renderEnvelope();
    fireEvent.doubleClick(points[1] as HTMLElement);
    expect(onValueCommit).toHaveBeenLastCalledWith([
      { x: 0, y: 0 },
      { x: 0.6, y: 0.5 },
      { x: 1, y: 0 },
    ]);
  });

  test("does not remove a point when allowRemovePoints is false", () => {
    const { points, onValueCommit } = renderEnvelope({
      allowRemovePoints: false,
    });
    fireEvent.doubleClick(points[1] as HTMLElement);
    expect(onValueCommit).not.toHaveBeenCalled();
  });

  test("blocks removal at minPoints via double-click", () => {
    const { points, onValueCommit } = renderEnvelope({
      value: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    fireEvent.doubleClick(points[0] as HTMLElement);
    expect(onValueCommit).not.toHaveBeenCalled();
  });
});
