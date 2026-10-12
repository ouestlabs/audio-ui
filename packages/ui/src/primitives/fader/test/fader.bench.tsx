import { describe, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { bench, expectWork, sweep } from "../../../../test/bench.ts";
import { mockRect } from "../../../../test/helpers.ts";
import { Fader } from "../../../entries/fader.ts";

let changes = 0;

function ControlledFader() {
  const [value, setValue] = useState(0);
  return (
    <Fader.Root
      max={6}
      min={-60}
      onValueChange={(next) => {
        changes += 1;
        setValue(next);
      }}
      value={value}
    >
      <Fader.Control data-testid="control">
        <Fader.Track>
          <Fader.Indicator />
        </Fader.Track>
        <Fader.Thumb aria-label="Volume" />
      </Fader.Control>
    </Fader.Root>
  );
}

describe("Fader", () => {
  test("a drag, re-rendered from state on every move", () => {
    const view = render(<ControlledFader />);
    const control = view.getByTestId("control");
    mockRect(control, { bottom: 200, height: 200, right: 20, width: 20 });
    fireEvent.pointerDown(control, { clientX: 10, clientY: 0, pointerId: 1 });
    bench("drag, controlled", (index) => {
      fireEvent.pointerMove(document, {
        buttons: 1,
        clientX: 10,
        clientY: sweep(index, 200),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(document, { pointerId: 1 });
    expectWork(changes);
  });
});
