import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers.ts";
import { Timeline } from "../../../../entries/timeline.ts";

function renderTrack(props: Timeline.Track.Props = {}) {
  const onHeightChange = mock(
    (
      _height: number | undefined,
      _details: Timeline.Track.ChangeEventDetails
    ) => undefined
  );
  const onHeightCommitted = mock(
    (
      _height: number | undefined,
      _details: Timeline.Track.CommitEventDetails
    ) => undefined
  );
  const view = render(
    <Timeline.Root duration={100}>
      <Timeline.Track
        data-testid="track"
        onHeightChange={onHeightChange}
        onHeightCommitted={onHeightCommitted}
        {...props}
      >
        <Timeline.TrackHeader data-testid="header">
          <Timeline.TrackResizeHandle
            aria-label="Height"
            data-testid="handle"
          />
        </Timeline.TrackHeader>
        <Timeline.Lane />
      </Timeline.Track>
    </Timeline.Root>
  );
  const handle = view.getByTestId("handle");
  return {
    handle,
    header: view.getByTestId("header"),
    input: view.getByRole("slider") as HTMLInputElement,
    onHeightChange,
    onHeightCommitted,
    track: view.getByTestId("track"),
    view,
  };
}

describe("Timeline.Track", () => {
  test("keeps the height it is given", () => {
    expect(renderTrack({ height: 96 }).track.style.height).toBe("96px");
  });

  test("shares the room it is given while it has no height", () => {
    expect(renderTrack().track.style.height).toBe("");
  });

  test("shows whether it is selected", () => {
    expect(
      renderTrack({ selected: true }).track.hasAttribute("data-selected")
    ).toBe(true);
  });

  test("is not selected unless it is told so", () => {
    expect(renderTrack().track.hasAttribute("data-selected")).toBe(false);
  });

  test("styles from its state", () => {
    const { track } = renderTrack({
      className: (state) => (state.selected ? "picked" : "plain"),
      selected: true,
    });
    expect(track.className).toBe("picked");
  });

  test("must be used within a timeline", () => {
    expect(() => render(<Timeline.Track />)).toThrow(
      "Timeline.Track must be used within Timeline.Root"
    );
  });
});

describe("Timeline.TrackHeader", () => {
  test("sticks to the left edge", () => {
    const { header } = renderTrack();
    expect(header.style.position).toBe("sticky");
    expect(header.style.left).toBe("0px");
  });

  test("sits above the lane's parts, at a level a header can raise", () => {
    expect(renderTrack().header.style.zIndex).toBe(
      "var(--timeline-track-header-z, 20)"
    );
  });

  test("carries the track's selection", () => {
    expect(
      renderTrack({ selected: true }).header.hasAttribute("data-selected")
    ).toBe(true);
  });

  test("must be used within a track", () => {
    expect(() =>
      render(
        <Timeline.Root duration={100}>
          <Timeline.TrackHeader />
        </Timeline.Root>
      )
    ).toThrow("Timeline.TrackHeader must be used within Timeline.Track");
  });
});

describe("Timeline.TrackResizeHandle keyboard", () => {
  test("Down is taller by a step, Up shorter, and each commits", () => {
    const { input, onHeightChange, onHeightCommitted } = renderTrack({
      height: 100,
    });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onHeightChange.mock.calls[0]?.[0]).toBe(108);
    expect(onHeightChange.mock.calls[0]?.[1].reason).toBe("keyboard");
    expect(onHeightCommitted.mock.calls[0]?.[0]).toBe(108);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onHeightChange.mock.calls[1]?.[0]).toBe(92);
  });

  test("Page keys move by the large step, Home and End to the limits", () => {
    const { input, onHeightChange } = renderTrack({
      height: 100,
      maxHeight: 200,
      minHeight: 40,
    });
    fireEvent.keyDown(input, { key: "PageDown" });
    fireEvent.keyDown(input, { key: "Home" });
    fireEvent.keyDown(input, { key: "End" });
    expect(onHeightChange.mock.calls.map((call) => call[0])).toEqual([
      132, 40, 200,
    ]);
  });

  test("never goes past the limits", () => {
    const { input, onHeightChange } = renderTrack({
      height: 40,
      minHeight: 40,
    });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onHeightChange).not.toHaveBeenCalled();
  });

  test("measures the track when no height is set", () => {
    const { input, onHeightChange, track } = renderTrack();
    mockRect(track, { height: 80 });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onHeightChange.mock.calls[0]?.[0]).toBe(88);
  });

  test("cancel() refuses the change, and nothing is committed", () => {
    const { input, onHeightCommitted } = renderTrack({
      height: 100,
      onHeightChange: (_height, details) => details.cancel(),
    });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onHeightCommitted).not.toHaveBeenCalled();
  });
});

describe("Timeline.TrackResizeHandle drag", () => {
  test("follows the pointer from the height it began at, and commits once", () => {
    const { handle, onHeightChange, onHeightCommitted } = renderTrack({
      height: 100,
    });
    fireEvent.pointerDown(handle, { button: 0, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, {
      button: 0,
      buttons: 1,
      clientY: 230,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle, {
      button: 0,
      buttons: 1,
      clientY: 215,
      pointerId: 1,
    });
    fireEvent.pointerUp(handle, { clientY: 215, pointerId: 1 });
    expect(onHeightChange.mock.calls.map((call) => call[0])).toEqual([
      130, 115,
    ]);
    expect(onHeightChange.mock.calls[0]?.[1].reason).toBe("drag");
    expect(onHeightCommitted).toHaveBeenCalledTimes(1);
    expect(onHeightCommitted.mock.calls[0]?.[0]).toBe(115);
  });

  test("a press that never moves commits nothing", () => {
    const { handle, onHeightCommitted } = renderTrack({ height: 100 });
    fireEvent.pointerDown(handle, { button: 0, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 200, pointerId: 1 });
    expect(onHeightCommitted).not.toHaveBeenCalled();
  });

  test("the press does not reach the track", () => {
    const onPointerDown = mock(() => undefined);
    const { handle } = renderTrack({ height: 100, onPointerDown });
    fireEvent.pointerDown(handle, { button: 0, clientY: 10, pointerId: 1 });
    expect(onPointerDown).not.toHaveBeenCalled();
  });

  test("marks the track as resizing while the pointer is down", () => {
    const { handle, track } = renderTrack({ height: 100 });
    fireEvent.pointerDown(handle, { button: 0, clientY: 10, pointerId: 1 });
    expect(track.hasAttribute("data-resizing")).toBe(true);
    fireEvent.pointerUp(handle, { clientY: 10, pointerId: 1 });
    expect(track.hasAttribute("data-resizing")).toBe(false);
  });
});

describe("Timeline.TrackResizeHandle double-click", () => {
  test("gives the height up, and commits it", () => {
    const { handle, onHeightChange, onHeightCommitted } = renderTrack({
      height: 100,
    });
    fireEvent.doubleClick(handle);
    expect(onHeightChange.mock.calls[0]?.[0]).toBeUndefined();
    expect(onHeightChange.mock.calls[0]?.[1].reason).toBe("double-click");
    expect(onHeightCommitted).toHaveBeenCalledTimes(1);
    expect(onHeightCommitted.mock.calls[0]?.[0]).toBeUndefined();
  });

  test("has nothing to give up while the track has no height", () => {
    const { handle, onHeightChange } = renderTrack();
    fireEvent.doubleClick(handle);
    expect(onHeightChange).not.toHaveBeenCalled();
  });

  test("cancel() keeps the height", () => {
    const { handle, onHeightCommitted } = renderTrack({
      height: 100,
      onHeightChange: (_height, details) => details.cancel(),
    });
    fireEvent.doubleClick(handle);
    expect(onHeightCommitted).not.toHaveBeenCalled();
  });
});
