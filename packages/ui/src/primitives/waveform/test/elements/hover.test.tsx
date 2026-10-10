import { describe, expect, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { renderWaveform } from "../helpers";

describe("Waveform.Hover", () => {
  test("appears at the hovered position while the pointer is over the control", () => {
    const { control, view } = renderWaveform();
    expect(view.queryByTestId("hover")).toBeNull();

    fireEvent.pointerMove(control, { clientX: 50, clientY: 20, pointerId: 1 });
    const hover = view.getByTestId("hover");
    expect(hover.style.left).toBe("25%");
    expect(hover.textContent).toBe("25s");

    fireEvent.pointerLeave(control);
    expect(view.queryByTestId("hover")).toBeNull();
  });
});
