import { describe, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { bench, expectWork, sweep } from "../../../../test/bench";
import { mockRect } from "../../../../test/helpers";
import { Envelope } from "../../../entries/envelope";

const POINTS: Envelope.Breakpoint[] = [
  { x: 0, y: 0 },
  { x: 0.2, y: 1 },
  { x: 0.6, y: 0.5 },
  { x: 1, y: 0 },
];

let changes = 0;

function ControlledEnvelope({
  points = POINTS,
}: {
  points?: Envelope.Breakpoint[];
}) {
  const [value, setValue] = useState(points);
  return (
    <Envelope.Root
      onValueChange={(next) => {
        changes += 1;
        setValue(next);
      }}
      value={value}
    >
      <Envelope.Graph data-testid="graph">
        <Envelope.Fill />
        <Envelope.Line />
      </Envelope.Graph>
      <Envelope.Segments>
        {(_point, index) => (
          <Envelope.Segment
            aria-label={`Curve ${index}`}
            index={index}
            key={index}
          />
        )}
      </Envelope.Segments>
      <Envelope.Points>
        {(_point, index) => (
          <Envelope.Point
            aria-label={`Point ${index}`}
            index={index}
            key={index}
          />
        )}
      </Envelope.Points>
    </Envelope.Root>
  );
}

describe("Envelope", () => {
  test("dragging a point", () => {
    const view = render(<ControlledEnvelope />);
    mockRect(view.getByTestId("graph"), {
      bottom: 100,
      height: 100,
      right: 200,
      width: 200,
    });
    const point = view.getByLabelText("Point 1");
    fireEvent.pointerDown(point, { clientX: 40, clientY: 0, pointerId: 1 });
    bench("drag a point, controlled", (index) => {
      fireEvent.pointerMove(point, {
        clientX: 40 + sweep(index, 60),
        clientY: sweep(index + 9, 100, 41),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(point, { pointerId: 1 });
    expectWork(changes);
    changes = 0;
  });

  test("bending a segment", () => {
    const view = render(<ControlledEnvelope />);
    mockRect(view.getByTestId("graph"), {
      bottom: 100,
      height: 100,
      right: 200,
      width: 200,
    });
    const segment = view.getByLabelText("Curve 0");
    fireEvent.pointerDown(segment, { clientX: 20, clientY: 50, pointerId: 1 });
    bench("bend a segment, controlled", (index) => {
      fireEvent.pointerMove(segment, {
        clientX: 20,
        clientY: 10 + sweep(index, 80),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(segment, { pointerId: 1 });
    expectWork(changes);
  });

  test("dragging a point in a 64-point envelope", () => {
    const many = Array.from({ length: 64 }, (_, index) => ({
      x: index / 63,
      y: 0.5 + 0.4 * Math.sin(index / 4),
    }));
    const view = render(<ControlledEnvelope points={many} />);
    mockRect(view.getByTestId("graph"), {
      bottom: 100,
      height: 100,
      right: 640,
      width: 640,
    });
    const point = view.getByLabelText("Point 32");
    fireEvent.pointerDown(point, { clientX: 320, clientY: 50, pointerId: 1 });
    changes = 0;
    bench("drag one of 64 points, controlled", (index) => {
      fireEvent.pointerMove(point, {
        clientX: 320 + sweep(index, 6) - 3,
        clientY: sweep(index + 7, 100, 43),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(point, { pointerId: 1 });
    expectWork(changes);
  });

  test("Alt-bending a segment of a 64-point envelope", () => {
    const many = Array.from({ length: 64 }, (_, index) => ({
      x: index / 63,
      y: index % 2 === 0 ? 0.2 : 0.8,
    }));
    const view = render(<ControlledEnvelope points={many} />);
    const graph = view.getByTestId("graph");
    mockRect(graph, { bottom: 100, height: 100, right: 640, width: 640 });
    changes = 0;
    fireEvent.pointerDown(graph, {
      altKey: true,
      button: 0,
      clientX: 5,
      clientY: 50,
      pointerId: 1,
    });
    bench("alt-bend one of 63 segments", (index) => {
      fireEvent.pointerMove(graph, {
        altKey: true,
        clientX: 5,
        clientY: 20 + sweep(index, 60),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(graph, { pointerId: 1 });
    expectWork(changes);
  });
});
