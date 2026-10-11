import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers";
import { Timeline } from "../../../../entries/timeline";
import { lastCall } from "../helpers";

const seconds = (value: number) => `${value}s`;

const start: Timeline.Clip.Value = {
  fadeIn: 0,
  fadeOut: 0,
  length: 40,
  offset: 10,
  start: 20,
};

/**
 * A clip on a 100-unit timeline whose lane is 200px wide: 2px per unit,
 * fitted. Extra props go to the clip, `rootProps` to the root.
 */
function renderClip(
  props: Timeline.Clip.Props = {},
  rootProps: Timeline.Root.Props = {}
) {
  const onValueChange = mock(
    (_value: Timeline.Clip.Value, _details: Timeline.Clip.ChangeEventDetails) =>
      undefined
  );
  const onValueCommitted = mock(
    (_value: Timeline.Clip.Value, _details: Timeline.Clip.CommitEventDetails) =>
      undefined
  );
  const onSelectedChange = mock(
    (_selected: boolean, _details: Timeline.Clip.SelectEventDetails) =>
      undefined
  );
  const onRemove = mock(
    (_details: Timeline.Clip.RemoveEventDetails) => undefined
  );
  const view = render(
    <Timeline.Root duration={100} {...rootProps}>
      <Timeline.Lane data-testid="lane">
        <Timeline.Clip
          aria-label="Take"
          data-testid="clip"
          defaultValue={start}
          getAriaValueText={seconds}
          onRemove={onRemove}
          onSelectedChange={onSelectedChange}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          sourceLength={60}
          {...props}
        >
          <Timeline.ClipFade data-testid="fade-in" edge="in" />
          <Timeline.ClipFade data-testid="fade-out" edge="out" />
          <Timeline.ClipHandle
            aria-label="Trim start"
            data-testid="trim-start"
            edge="start"
          />
          <Timeline.ClipHandle
            aria-label="Trim end"
            data-testid="trim-end"
            edge="end"
          />
          <Timeline.ClipFadeHandle
            aria-label="Fade in"
            data-testid="fade-in-handle"
            edge="in"
          />
          <Timeline.ClipFadeHandle
            aria-label="Fade out"
            data-testid="fade-out-handle"
            edge="out"
          />
        </Timeline.Clip>
      </Timeline.Lane>
    </Timeline.Root>
  );
  const lane = view.getByTestId("lane");
  mockRect(lane, { bottom: 20, height: 20, right: 200, width: 200 });
  const clip = view.getByTestId("clip");
  return {
    clip,
    fadeInHandle: view.getByTestId("fade-in-handle"),
    fadeOutHandle: view.getByTestId("fade-out-handle"),
    input: view.getByLabelText("Take") as HTMLInputElement,
    lane,
    onRemove,
    onSelectedChange,
    onValueChange,
    onValueCommitted,
    place: () => [
      clip.style.getPropertyValue("--timeline-offset"),
      clip.style.getPropertyValue("--timeline-length"),
      clip.style.getPropertyValue("--clip-offset"),
    ],
    trimEnd: view.getByTestId("trim-end"),
    trimStart: view.getByTestId("trim-start"),
    view,
  };
}

function drag(
  element: HTMLElement,
  from: number,
  to: number,
  init: { metaKey?: boolean } = {}
) {
  fireEvent.pointerDown(element, { clientX: from, pointerId: 1, ...init });
  fireEvent.pointerMove(element, { clientX: to, pointerId: 1, ...init });
  fireEvent.pointerUp(element, { clientX: to, pointerId: 1, ...init });
}

describe("Timeline.Clip", () => {
  test("sits from its start, as long as it lasts, and says where in the source it begins", () => {
    expect(renderClip().place()).toEqual(["20", "40", "10"]);
  });

  test("dragging the body moves it, keeping its length and source, and commits on release", () => {
    const { clip, onValueChange, onValueCommitted, place } = renderClip();
    fireEvent.pointerDown(clip, { clientX: 80, pointerId: 1 });
    expect(clip.hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerMove(clip, { clientX: 100, pointerId: 1 });
    expect(lastCall(onValueChange)).toEqual([
      { ...start, start: 30 },
      expect.objectContaining({ reason: "drag", target: "move" }),
    ]);
    fireEvent.pointerUp(clip, { clientX: 100, pointerId: 1 });
    expect(lastCall(onValueCommitted)).toEqual([
      { ...start, start: 30 },
      expect.objectContaining({ reason: "drag", target: "move" }),
    ]);
    expect(place()).toEqual(["30", "40", "10"]);
  });

  test("moves on the grid, unless Cmd/Ctrl is held", () => {
    const grid = { snapStep: 8 };
    const snapped = renderClip({}, grid);
    drag(snapped.clip, 80, 91);
    expect(snapped.place()[0]).toBe("24");
    snapped.view.unmount();

    const free = renderClip({}, grid);
    drag(free.clip, 80, 91, { metaKey: true });
    expect(free.place()[0]).toBe("25.5");
  });

  test("a click that moves nothing commits nothing", () => {
    const { clip, onValueChange, onValueCommitted } = renderClip();
    drag(clip, 80, 80);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
  });

  test("a press selects it, once", () => {
    const { clip, onSelectedChange } = renderClip();
    expect(clip.hasAttribute("data-selected")).toBe(false);
    drag(clip, 80, 80);
    expect(clip.hasAttribute("data-selected")).toBe(true);
    expect(lastCall(onSelectedChange)).toEqual([
      true,
      expect.objectContaining({ reason: "press" }),
    ]);
    drag(clip, 80, 80);
    expect(onSelectedChange).toHaveBeenCalledTimes(1);
  });

  test("a controlled selection follows the prop", () => {
    const { clip, onSelectedChange } = renderClip({ selected: false });
    drag(clip, 80, 80);
    expect(onSelectedChange).toHaveBeenCalledTimes(1);
    expect(clip.hasAttribute("data-selected")).toBe(false);
  });

  test("reports the lane the pointer is over, and commits a drop on another one", () => {
    const other = document.createElement("div");
    other.setAttribute("data-timeline-lane", "");
    const { clip, lane, onValueCommitted } = renderClip();
    const elementsFromPoint = mock(() => [lane] as Element[]);
    document.elementsFromPoint = elementsFromPoint as never;
    fireEvent.pointerDown(clip, { clientX: 80, clientY: 10, pointerId: 1 });
    elementsFromPoint.mockImplementation(() => [other]);
    fireEvent.pointerMove(clip, { clientX: 80, clientY: 50, pointerId: 1 });
    expect(clip.style.getPropertyValue("--clip-drag-y")).toBe("40px");
    fireEvent.pointerUp(clip, { clientX: 80, clientY: 50, pointerId: 1 });
    // Nothing moved along the lane, but the clip was dropped on another one
    expect(lastCall(onValueCommitted)[1]).toEqual(
      expect.objectContaining({ lane: other, target: "move" })
    );
    expect(clip.style.getPropertyValue("--clip-drag-y")).toBe("0px");
    (document as { elementsFromPoint?: unknown }).elementsFromPoint = undefined;
  });

  test("cannot be dragged when disabled", () => {
    const { clip, onValueChange } = renderClip({ disabled: true });
    drag(clip, 80, 120);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("Delete and Backspace ask for its removal", () => {
    const { input, onRemove } = renderClip();
    fireEvent.keyDown(input, { key: "Delete" });
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onRemove).toHaveBeenCalledTimes(2);
    expect(lastCall(onRemove)[0]).toEqual(
      expect.objectContaining({ reason: "keyboard" })
    );
  });

  test("the arrow keys move it, and Shift moves it further", () => {
    const { input, onValueCommitted, place } = renderClip();
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(place()[0]).toBe("21");
    expect(lastCall(onValueCommitted)[1]).toEqual(
      expect.objectContaining({ reason: "keyboard", target: "move" })
    );
    fireEvent.keyDown(input, { key: "ArrowLeft", shiftKey: true });
    expect(Number(place()[0])).toBeLessThan(21);
  });

  test("its input is named and announces where the clip lies", () => {
    const { input } = renderClip();
    expect(input.getAttribute("aria-valuetext")).toBe("20s to 60s");
    expect(input.max).toBe("60");
  });

  test("trimming the start moves where in the source it begins, and keeps its content in place", () => {
    const { onValueChange, onValueCommitted, place, trimStart } = renderClip();
    // 20 → 30 on the timeline: the clip loses its first ten units
    drag(trimStart, 40, 60);
    expect(lastCall(onValueChange)).toEqual([
      { ...start, length: 30, offset: 20, start: 30 },
      expect.objectContaining({ reason: "drag", target: "trim-start" }),
    ]);
    expect(lastCall(onValueCommitted)[1]).toEqual(
      expect.objectContaining({ target: "trim-start" })
    );
    expect(place()).toEqual(["30", "30", "20"]);
  });

  test("trimming the start back stops at the beginning of the source", () => {
    const { place, trimStart } = renderClip();
    drag(trimStart, 40, 0);
    // Only ten units of source lie before the clip's offset
    expect(place()).toEqual(["10", "50", "0"]);
  });

  test("trimming the end stops where the source runs out", () => {
    const { place, trimEnd } = renderClip();
    drag(trimEnd, 120, 200);
    // 60 of source, ten skipped: the clip can last fifty at most
    expect(place()).toEqual(["20", "50", "10"]);
  });

  test("a trim press never moves the clip", () => {
    const { onValueChange, trimEnd } = renderClip();
    drag(trimEnd, 120, 140);
    expect(
      onValueChange.mock.calls.every(([, d]) => d.target === "trim-end")
    ).toBe(true);
  });

  test("a trim handle's input trims from the keyboard", () => {
    const { onValueCommitted, view } = renderClip();
    const input = view.getByLabelText("Trim end") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(lastCall(onValueCommitted)).toEqual([
      { ...start, length: 39 },
      expect.objectContaining({ reason: "keyboard", target: "trim-end" }),
    ]);
  });

  test("dragging a fade handle sets how long the fade lasts", () => {
    const { clip, fadeInHandle, fadeOutHandle, onValueChange } = renderClip();
    drag(fadeInHandle, 40, 60);
    expect(lastCall(onValueChange)[0].fadeIn).toBe(10);
    expect(clip.style.getPropertyValue("--clip-fade-in")).toBe("10");
    // The fade-out grows as its handle moves towards the start
    drag(fadeOutHandle, 120, 100);
    expect(lastCall(onValueChange)[0].fadeOut).toBe(10);
    expect(lastCall(onValueChange)[1]).toEqual(
      expect.objectContaining({ target: "fade-out" })
    );
  });

  test("the fades cannot overlap", () => {
    const { fadeInHandle, onValueChange } = renderClip({
      defaultValue: { ...start, fadeOut: 30 },
    });
    drag(fadeInHandle, 40, 200);
    expect(lastCall(onValueChange)[0].fadeIn).toBe(10);
  });

  test("a fade's shading is hidden while the fade is empty", () => {
    const { view } = renderClip({ defaultValue: { ...start, fadeIn: 5 } });
    expect(view.getByTestId("fade-in").style.display).toBe("");
    expect(view.getByTestId("fade-out").style.display).toBe("none");
  });

  test("a controlled clip is followed during a drag even if the parent lags", () => {
    const { clip, place } = renderClip({ value: start });
    fireEvent.pointerDown(clip, { clientX: 80, pointerId: 1 });
    fireEvent.pointerMove(clip, { clientX: 100, pointerId: 1 });
    expect(place()[0]).toBe("30");
    fireEvent.pointerUp(clip, { clientX: 100, pointerId: 1 });
    expect(place()[0]).toBe("20");
  });

  test("a change that is cancelled is not applied", () => {
    const { clip, place } = renderClip({
      onValueChange: (_value, details) => details.cancel(),
    });
    drag(clip, 80, 100);
    expect(place()[0]).toBe("20");
  });

  test("mounting outside a lane or a clip says so", () => {
    const spy = mock(() => undefined);
    const original = console.error;
    console.error = spy;
    expect(() =>
      render(
        <Timeline.Root duration={100}>
          <Timeline.Clip aria-label="Take" />
        </Timeline.Root>
      )
    ).toThrow("within a Timeline lane");
    expect(() =>
      render(<Timeline.ClipHandle aria-label="Trim" edge="start" />)
    ).toThrow("within Timeline.Clip");
    console.error = original;
  });
});
