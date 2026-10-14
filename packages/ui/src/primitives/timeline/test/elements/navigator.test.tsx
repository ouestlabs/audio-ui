import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers.ts";
import { Timeline } from "../../../../entries/timeline.ts";

/**
 * A 100-unit timeline at 10px per unit in a 300px viewport whose lanes start
 * 100px in, past a column of headers: 200px of lane shows 20 units. The
 * navigator's track is 500px wide, 5px per unit.
 */
function renderNavigator(rootProps: Timeline.Root.Props = {}) {
  const onZoomChange = mock(
    (_zoom: number, _details: Timeline.Root.ZoomChangeEventDetails) => undefined
  );
  const view = render(
    <Timeline.Root
      defaultZoom={10}
      duration={100}
      onZoomChange={onZoomChange}
      {...rootProps}
    >
      <Timeline.Viewport data-testid="viewport">
        <Timeline.Lane data-testid="lane" />
      </Timeline.Viewport>
      <Timeline.Navigator data-testid="navigator">
        <Timeline.NavigatorWindow
          aria-label="Visible range"
          data-testid="window"
        />
        <Timeline.NavigatorHandle
          aria-label="Visible start"
          data-testid="start"
          edge="start"
        />
        <Timeline.NavigatorHandle
          aria-label="Visible end"
          data-testid="end"
          edge="end"
        />
      </Timeline.Navigator>
    </Timeline.Root>
  );
  const viewport = view.getByTestId("viewport");
  Object.defineProperty(viewport, "clientWidth", { value: 300 });
  mockRect(viewport, { right: 300, width: 300 });
  view.getByTestId("lane").getBoundingClientRect = () =>
    ({ left: 100 - viewport.scrollLeft, width: 1000 }) as DOMRect;
  mockRect(view.getByTestId("navigator"), { right: 500, width: 500 });
  const scroll = (left: number) =>
    act(() => {
      viewport.scrollLeft = left;
      viewport.dispatchEvent(new Event("scroll"));
    });
  scroll(0);
  const windowPart = view.getByTestId("window");
  return {
    end: view.getByTestId("end"),
    endInput: view.getByLabelText("Visible end") as HTMLInputElement,
    onZoomChange,
    scroll,
    shown: () => [windowPart.style.left, windowPart.style.width],
    start: view.getByTestId("start"),
    view,
    viewport,
    windowInput: view.getByLabelText("Visible range") as HTMLInputElement,
    windowPart,
  };
}

function drag(element: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(element, { clientX: from, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: to, pointerId: 1 });
  fireEvent.pointerUp(element, { clientX: to, pointerId: 1 });
}

describe("Timeline.Navigator", () => {
  test("draws the visible stretch inside the whole timeline", () => {
    const { scroll, shown } = renderNavigator();
    expect(shown()).toEqual(["0%", "20%"]);
    scroll(300);
    expect(shown()).toEqual(["30%", "20%"]);
  });

  test("measures in layout px inside a scaled ancestor", () => {
    // Fitted to its lanes, drawn at twice its size: 200px of lane shows all 100 units.
    const { shown, viewport, view } = renderNavigator({
      defaultZoom: undefined,
    });
    Object.defineProperty(viewport, "offsetWidth", { value: 300 });
    mockRect(viewport, { right: 600, width: 600 });
    view.getByTestId("lane").getBoundingClientRect = () =>
      ({ left: 200, width: 400 }) as DOMRect;
    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(shown()).toEqual(["0%", "100%"]);
  });

  test("dragging the window scrolls the viewport", () => {
    const { shown, viewport, windowPart } = renderNavigator();
    // 50px of navigator is 10 units, 100px of content at 10px per unit
    drag(windowPart, 20, 70);
    expect(viewport.scrollLeft).toBe(100);
    expect(shown()).toEqual(["10%", "20%"]);
  });

  test("dragging the end handle zooms, holding the start in place", () => {
    const { end, onZoomChange, scroll, viewport } = renderNavigator();
    scroll(100);
    // Showing 10…30: dragging the end 50px to the right shows 10…40
    drag(end, 150, 200);
    const [zoom, details] = onZoomChange.mock.calls.at(-1) ?? [];
    expect(zoom).toBeCloseTo(200 / 30);
    expect(details?.reason).toBe("drag");
    expect(viewport.scrollLeft).toBeCloseTo(10 * (zoom ?? 0));
  });

  test("dragging the start handle zooms, holding the end in place", () => {
    const { onZoomChange, scroll, start } = renderNavigator();
    scroll(100);
    // Showing 10…30: dragging the start 25px to the right shows 15…30
    drag(start, 50, 75);
    expect(onZoomChange.mock.calls.at(-1)?.[0]).toBeCloseTo(200 / 15);
  });

  test("a double-click shows the whole timeline", () => {
    const { onZoomChange, view } = renderNavigator();
    fireEvent.doubleClick(view.getByTestId("navigator"));
    const [zoom, details] = onZoomChange.mock.calls.at(-1) ?? [];
    expect(zoom).toBe(2);
    expect(details?.reason).toBe("double-click");
  });

  test("the window's input scrolls from the keyboard", () => {
    const { shown, windowInput } = renderNavigator();
    expect(windowInput.getAttribute("aria-valuetext")).toBe("0 to 20");
    fireEvent.keyDown(windowInput, { key: "ArrowRight" });
    expect(shown()).toEqual(["2%", "20%"]);
    fireEvent.keyDown(windowInput, { key: "End" });
    expect(shown()).toEqual(["80%", "20%"]);
  });

  test("an edge's input zooms from the keyboard", () => {
    const { endInput, onZoomChange } = renderNavigator();
    expect([endInput.min, endInput.max, endInput.value]).toEqual([
      "0",
      "100",
      "20",
    ]);
    fireEvent.keyDown(endInput, { key: "ArrowRight" });
    // Showing 0…22
    expect(onZoomChange.mock.calls.at(-1)?.[0]).toBeCloseTo(200 / 22);
  });

  test("ignores the pointer and the keyboard when disabled", () => {
    const { onZoomChange, end, endInput, viewport, windowPart } =
      renderNavigator({ disabled: true });
    drag(windowPart, 20, 70);
    drag(end, 100, 150);
    fireEvent.keyDown(endInput, { key: "ArrowRight" });
    expect(viewport.scrollLeft).toBe(0);
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  test("its parts must be used within it", () => {
    expect(() =>
      render(
        <Timeline.Root>
          <Timeline.NavigatorWindow />
        </Timeline.Root>
      )
    ).toThrow(
      "Timeline.NavigatorWindow must be used within Timeline.Navigator"
    );
  });
});
