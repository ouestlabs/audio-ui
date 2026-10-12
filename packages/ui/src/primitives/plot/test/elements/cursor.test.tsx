import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers.js";
import { Plot } from "../../../../entries/plot.js";

const format = (value: { x: number; y: number }) =>
  `${value.x.toFixed(0)}, ${value.y.toFixed(1)}`;

function renderCursor() {
  const view = render(
    <Plot.Root data-testid="root" maxX={100} maxY={10} minX={0} minY={0}>
      <Plot.Cursor data-testid="cursor">
        <Plot.CursorReadout data-testid="readout" format={format} />
      </Plot.Cursor>
    </Plot.Root>
  );
  const root = view.getByTestId("root");
  mockRect(root, { bottom: 100, height: 100, right: 200, width: 200 });
  return {
    cursor: view.getByTestId("cursor"),
    readout: view.getByTestId("readout"),
    root,
  };
}

describe("Plot.Cursor", () => {
  test("is hidden from assistive technology and lets pointers through", () => {
    const { cursor } = renderCursor();
    expect(cursor.getAttribute("aria-hidden")).toBe("true");
    expect(cursor.style.pointerEvents).toBe("none");
    expect(cursor.hasAttribute("data-active")).toBe(false);
  });

  test("follows the pointer in CSS variables and says what is under it", () => {
    const { cursor, readout, root } = renderCursor();
    fireEvent.pointerMove(root, {
      clientX: 50,
      clientY: 25,
      pointerType: "mouse",
    });
    expect(cursor.hasAttribute("data-active")).toBe(true);
    expect(cursor.style.getPropertyValue("--plot-cursor-x")).toBe("25%");
    expect(cursor.style.getPropertyValue("--plot-cursor-y")).toBe("25%");
    expect(readout.textContent).toBe("25, 7.5");
    expect(readout.style.left).toBe("var(--plot-cursor-x)");
  });

  test("goes away when the pointer leaves", () => {
    const { cursor, readout, root } = renderCursor();
    fireEvent.pointerMove(root, {
      clientX: 50,
      clientY: 25,
      pointerType: "mouse",
    });
    fireEvent.pointerLeave(root);
    expect(cursor.hasAttribute("data-active")).toBe(false);
    expect(readout.textContent).toBe("");
  });

  test("ignores touch, which has no pointer to follow", () => {
    const { cursor, root } = renderCursor();
    fireEvent.pointerMove(root, {
      clientX: 50,
      clientY: 25,
      pointerType: "touch",
    });
    expect(cursor.hasAttribute("data-active")).toBe(false);
  });

  test("a readout needs a cursor", () => {
    expect(() =>
      render(
        <Plot.Root>
          <Plot.CursorReadout format={format} />
        </Plot.Root>
      )
    ).toThrow("Plot.CursorReadout must be used within Plot.Cursor");
  });
});
