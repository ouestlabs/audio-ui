import { describe, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { bench, expectWork, sweep } from "../../../../test/bench.ts";
import { mockRect } from "../../../../test/helpers.ts";
import { XYPad } from "../../../entries/xypad.ts";

let changes = 0;

function ControlledPad() {
  const [value, setValue] = useState({ x: 50, y: 50 });
  return (
    <XYPad.Root
      maxX={100}
      maxY={100}
      minX={0}
      minY={0}
      onValueChange={(next) => {
        changes += 1;
        setValue(next);
      }}
      value={value}
    >
      <XYPad.Control data-testid="pad">
        <XYPad.Thumb aria-label="Filter" />
      </XYPad.Control>
      <XYPad.Value />
    </XYPad.Root>
  );
}

describe("XY Pad", () => {
  test("a drag over both axes, re-rendered from state on every move", () => {
    const view = render(<ControlledPad />);
    const pad = view.getByTestId("pad");
    mockRect(pad, { bottom: 200, height: 200, right: 200, width: 200 });
    fireEvent.pointerDown(pad, { clientX: 100, clientY: 100, pointerId: 1 });
    bench("drag, controlled", (index) => {
      fireEvent.pointerMove(pad, {
        clientX: sweep(index, 200),
        clientY: sweep(index + 13, 200, 47),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    expectWork(changes);
  });
});
