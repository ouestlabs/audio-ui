import { describe, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { bench, expectWork, sweep } from "../../../../test/bench";
import { mockRect } from "../../../../test/helpers";
import { Knob } from "../../../entries/knob";

let changes = 0;

function ControlledKnob() {
  const [value, setValue] = useState(50);
  return (
    <Knob.Root
      max={100}
      min={0}
      onValueChange={(next) => {
        changes += 1;
        setValue(next);
      }}
      value={value}
    >
      <Knob.Control data-testid="control">
        <Knob.Track />
        <Knob.Indicator />
        <Knob.Thumb aria-label="Cutoff" />
      </Knob.Control>
      <Knob.Value />
    </Knob.Root>
  );
}

describe("Knob", () => {
  test("a drag, re-rendered from state on every move", () => {
    const view = render(<ControlledKnob />);
    const control = view.getByTestId("control");
    mockRect(control, { bottom: 100, height: 100, right: 100, width: 100 });
    fireEvent.pointerDown(control, { clientX: 50, clientY: 10, pointerId: 1 });
    bench("drag, controlled", (index) => {
      // Round the centre, as a hand turning the knob does.
      const angle = (sweep(index, 120) * Math.PI) / 180;
      fireEvent.pointerMove(control, {
        clientX: 50 + 40 * Math.sin(angle),
        clientY: 50 - 40 * Math.cos(angle),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(control, { pointerId: 1 });
    expectWork(changes);
  });
});
