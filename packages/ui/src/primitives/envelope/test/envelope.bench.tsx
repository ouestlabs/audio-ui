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

function ControlledEnvelope() {
  const [value, setValue] = useState(POINTS);
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
});
