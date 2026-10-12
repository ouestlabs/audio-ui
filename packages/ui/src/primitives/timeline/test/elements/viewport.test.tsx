import { describe, expect, mock, test } from "bun:test";
import { act, render } from "@testing-library/react";
import { useState } from "react";
import { mockRect } from "../../../../../test/helpers.js";
import { Timeline } from "../../../../entries/timeline.js";

/**
 * A viewport 300px wide at the origin, its lane starting 40px in (past a
 * column of headers) and scrolled by `scrollLeft`.
 */
function renderViewport(rootProps: Timeline.Root.Props = {}, scrollLeft = 0) {
  const onZoomChange = mock(
    (_zoom: number, _details: Timeline.Root.ZoomChangeEventDetails) => undefined
  );
  const view = render(
    <Timeline.Root duration={100} onZoomChange={onZoomChange} {...rootProps}>
      <Timeline.Viewport data-testid="viewport">
        <Timeline.Lane data-testid="lane" />
      </Timeline.Viewport>
    </Timeline.Root>
  );
  const viewport = view.getByTestId("viewport");
  const lane = view.getByTestId("lane");
  Object.defineProperty(viewport, "clientWidth", { value: 300 });
  viewport.scrollLeft = scrollLeft;
  mockRect(viewport, { right: 300, width: 300 });
  // The lane moves left as the viewport scrolls.
  lane.getBoundingClientRect = () =>
    ({
      left: 40 - viewport.scrollLeft,
      right: 40 - viewport.scrollLeft + 1000,
      width: 1000,
    }) as DOMRect;
  return { lane, onZoomChange, view, viewport };
}

/** The test DOM drops modifier keys and coordinates from WheelEvent's init: set them by hand. */
function wheel(
  target: HTMLElement,
  init: {
    clientX: number;
    ctrlKey?: boolean;
    deltaY: number;
    metaKey?: boolean;
  }
): WheelEvent {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY: init.deltaY,
  });
  Object.defineProperties(event, {
    clientX: { value: init.clientX },
    ctrlKey: { value: Boolean(init.ctrlKey) },
    metaKey: { value: Boolean(init.metaKey) },
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

/** Lets the frame the wheel's zoom is applied in come. */
const nextFrame = () =>
  act(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );

describe("Timeline.Viewport", () => {
  test("scrolls on its own axis", () => {
    const { viewport } = renderViewport();
    expect(viewport.style.overflowX).toBe("auto");
  });

  test("Cmd/Ctrl + wheel zooms in around the pointer", async () => {
    const { onZoomChange, viewport } = renderViewport({ defaultZoom: 10 }, 200);
    const event = wheel(viewport, {
      clientX: 140,
      ctrlKey: true,
      deltaY: -100,
    });
    expect(event.defaultPrevented).toBe(true);
    await nextFrame();
    const [zoom, details] = onZoomChange.mock.calls.at(-1) ?? [];
    expect(zoom).toBeCloseTo(10 * Math.exp(0.15));
    expect(details?.reason).toBe("wheel");
    // The value under the pointer: (200 + 140 - 40) / 10 = 30, still at 140px
    expect(viewport.scrollLeft).toBeCloseTo(40 + 30 * (zoom ?? 0) - 140);
  });

  test("wheel events in one frame are added up into one zoom", async () => {
    const { onZoomChange, viewport } = renderViewport({ defaultZoom: 10 }, 200);
    wheel(viewport, { clientX: 140, ctrlKey: true, deltaY: -50 });
    wheel(viewport, { clientX: 140, ctrlKey: true, deltaY: -50 });
    wheel(viewport, { clientX: 140, ctrlKey: true, deltaY: -100 });
    expect(onZoomChange).not.toHaveBeenCalled();
    await nextFrame();
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    expect(onZoomChange.mock.calls[0]?.[0]).toBeCloseTo(10 * Math.exp(0.3));
  });

  test("a bare wheel scrolls and leaves the zoom alone", () => {
    const { onZoomChange, viewport } = renderViewport({ defaultZoom: 10 });
    wheel(viewport, { clientX: 140, deltaY: -100 });
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  test("respects the zoom bounds", async () => {
    const { onZoomChange, viewport } = renderViewport({
      defaultZoom: 10,
      maxZoom: 10,
    });
    wheel(viewport, { clientX: 140, ctrlKey: true, deltaY: -100 });
    await nextFrame();
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  test("zooming a fitted timeline starts from what fitting gave", async () => {
    const { onZoomChange, viewport } = renderViewport();
    wheel(viewport, { clientX: 140, deltaY: 100, metaKey: true });
    await nextFrame();
    // The lane is 1000px for 100 units: 10px per unit before the wheel
    expect(onZoomChange.mock.calls.at(-1)?.[0]).toBeCloseTo(
      10 * Math.exp(-0.15)
    );
  });

  test("a zoom from elsewhere keeps the middle of the view in place", () => {
    let setZoom: (zoom: number) => void = () => undefined;
    function Controlled() {
      const [zoom, set] = useState(10);
      setZoom = set;
      return (
        <Timeline.Root duration={100} zoom={zoom}>
          <Timeline.Viewport data-testid="viewport">
            <Timeline.Lane data-testid="lane" />
          </Timeline.Viewport>
        </Timeline.Root>
      );
    }
    const view = render(<Controlled />);
    const viewport = view.getByTestId("viewport");
    Object.defineProperty(viewport, "clientWidth", { value: 300 });
    mockRect(viewport, { right: 300, width: 300 });
    view.getByTestId("lane").getBoundingClientRect = () =>
      ({ left: -viewport.scrollLeft, width: 1000 }) as DOMRect;
    viewport.scrollLeft = 100;
    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    // The middle shows (100 + 150) / 10 = 25; at 20px per unit it stays at 150px
    act(() => setZoom(20));
    expect(viewport.scrollLeft).toBe(25 * 20 - 150);
  });

  test("leaves the wheel alone when disabled", () => {
    const { onZoomChange, viewport } = renderViewport({
      defaultZoom: 10,
      disabled: true,
    });
    wheel(viewport, { clientX: 140, ctrlKey: true, deltaY: -100 });
    expect(onZoomChange).not.toHaveBeenCalled();
  });
});
