import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers";
import { Waveform } from "../../../../waveform";
import { lastCall, seconds } from "../helpers";

/** A region on a 100-second track, over a 200px control: 2px per second. */
function renderRegion(props: Waveform.Region.Props = {}) {
  const onSeek = mock((_value: number) => undefined);
  const onValueChange = mock(
    (
      _value: Waveform.Region.Value,
      _details: Waveform.Region.ChangeEventDetails
    ) => undefined
  );
  const onValueCommitted = mock(
    (
      _value: Waveform.Region.Value,
      _details: Waveform.Region.CommitEventDetails
    ) => undefined
  );
  const view = render(
    <Waveform.Root duration={100} onValueChange={onSeek}>
      <Waveform.Control aria-label="Seek" data-testid="control">
        <Waveform.Region
          data-testid="region"
          defaultValue={[20, 60]}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          {...props}
        >
          <Waveform.RegionHandle
            aria-label="Loop start"
            data-testid="start"
            edge="start"
            getAriaValueText={seconds}
          />
          <Waveform.RegionHandle
            aria-label="Loop end"
            data-testid="end"
            edge="end"
          />
        </Waveform.Region>
      </Waveform.Control>
    </Waveform.Root>
  );
  mockRect(view.getByTestId("control"), { right: 200, width: 200 });
  const region = view.getByTestId("region");
  return {
    end: view.getByTestId("end"),
    endInput: view.getByLabelText("Loop end") as HTMLInputElement,
    onSeek,
    onValueChange,
    onValueCommitted,
    region,
    span: () => [region.style.left, region.style.width],
    start: view.getByTestId("start"),
    startInput: view.getByLabelText("Loop start") as HTMLInputElement,
    view,
  };
}

/** Press at `from`, move to `to`, release. */
function drag(element: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(element, { clientX: from, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: to, pointerId: 1 });
  fireEvent.pointerUp(element, { clientX: to, pointerId: 1 });
}

describe("Waveform.Region", () => {
  test("spans from its start to its end, as percentages of the timeline", () => {
    expect(renderRegion().span()).toEqual(["20%", "40%"]);
  });

  test("covers the whole timeline by default", () => {
    const view = render(
      <Waveform.Root duration={100}>
        <Waveform.Region data-testid="region" />
      </Waveform.Root>
    );
    const region = view.getByTestId("region");
    expect([region.style.left, region.style.width]).toEqual(["0%", "100%"]);
  });

  test("orders its edges and keeps them on the timeline", () => {
    expect(renderRegion({ value: [140, 30] }).span()).toEqual(["30%", "70%"]);
  });

  test("dragging its body moves it, keeping its length, and commits on release", () => {
    const { onValueChange, onValueCommitted, region, span } = renderRegion();

    fireEvent.pointerDown(region, { clientX: 80, pointerId: 1 });
    expect(region.hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerMove(region, { clientX: 100, pointerId: 1 });
    expect(lastCall(onValueChange)).toEqual([
      [30, 70],
      expect.objectContaining({ edge: "both", reason: "drag" }),
    ]);
    expect(span()).toEqual(["30%", "40%"]);

    fireEvent.pointerUp(region, { clientX: 100, pointerId: 1 });
    expect(lastCall(onValueCommitted)).toEqual([
      [30, 70],
      expect.objectContaining({ edge: "both", reason: "drag" }),
    ]);
    expect(region.hasAttribute("data-dragging")).toBe(false);
  });

  test("stops at the ends of the timeline", () => {
    const { region, span } = renderRegion();
    drag(region, 80, 900);
    expect(span()).toEqual(["60%", "40%"]);
  });

  test("a press on the region never seeks the waveform underneath", () => {
    const { onSeek, region, start } = renderRegion();
    drag(region, 80, 100);
    drag(start, 40, 20);
    expect(onSeek).not.toHaveBeenCalled();
  });

  test("a press that moves nothing doesn't commit", () => {
    const { onValueCommitted, region } = renderRegion();
    drag(region, 80, 80);
    expect(onValueCommitted).not.toHaveBeenCalled();
  });

  test("movable={false} keeps the body where it is, still without seeking", () => {
    const { onSeek, onValueChange, region } = renderRegion({ movable: false });
    drag(region, 80, 120);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onSeek).not.toHaveBeenCalled();
  });

  test("a controlled region that lags doesn't pull back mid-drag", () => {
    const { region, span } = renderRegion({ value: [20, 60] });
    fireEvent.pointerDown(region, { clientX: 80, pointerId: 1 });
    fireEvent.pointerMove(region, { clientX: 100, pointerId: 1 });
    expect(span()).toEqual(["30%", "40%"]);
    fireEvent.pointerUp(region, { clientX: 100, pointerId: 1 });
    expect(span()).toEqual(["20%", "40%"]);
  });

  test("eventDetails.cancel() rejects the change", () => {
    const { region, span } = renderRegion({
      onValueChange: (_value, details) => details.cancel(),
    });
    drag(region, 80, 100);
    expect(span()).toEqual(["20%", "40%"]);
  });

  test("ignores the pointer and the keyboard when disabled", () => {
    const { onValueChange, region, start, startInput } = renderRegion({
      disabled: true,
    });
    drag(region, 80, 100);
    drag(start, 40, 20);
    fireEvent.keyDown(startInput, { key: "ArrowRight" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(startInput.disabled).toBe(true);
    expect(region.hasAttribute("data-disabled")).toBe(true);
  });

  test("inherits disabled from the root", () => {
    const view = render(
      <Waveform.Root disabled duration={100}>
        <Waveform.Region data-testid="region" />
      </Waveform.Root>
    );
    expect(view.getByTestId("region").hasAttribute("data-disabled")).toBe(true);
  });
});

describe("Waveform.RegionHandle", () => {
  test("holds a named native range input bounded by the other edge", () => {
    const { endInput, start, startInput } = renderRegion();
    expect(startInput.type).toBe("range");
    expect([startInput.min, startInput.max, startInput.value]).toEqual([
      "0",
      "59",
      "20",
    ]);
    expect([endInput.min, endInput.max, endInput.value]).toEqual([
      "21",
      "100",
      "60",
    ]);
    expect(start.getAttribute("data-edge")).toBe("start");
  });

  test("announces its position: a share of the timeline, or what getAriaValueText returns", () => {
    const { endInput, startInput } = renderRegion();
    expect(startInput.getAttribute("aria-valuetext")).toBe("20s");
    expect(endInput.getAttribute("aria-valuetext")).toBe("60%");
  });

  test("dragging a handle resizes that edge only", () => {
    const { end, onValueChange, onValueCommitted, span, start } =
      renderRegion();

    drag(start, 40, 20);
    expect(lastCall(onValueChange)).toEqual([
      [10, 60],
      expect.objectContaining({ edge: "start", reason: "drag" }),
    ]);

    drag(end, 120, 160);
    expect(lastCall(onValueCommitted)).toEqual([
      [10, 80],
      expect.objectContaining({ edge: "end", reason: "drag" }),
    ]);
    expect(span()).toEqual(["10%", "70%"]);
  });

  test("an edge stops a minimum length short of the other one", () => {
    const { span, start } = renderRegion({ minLength: 10 });
    drag(start, 40, 900);
    expect(span()).toEqual(["50%", "10%"]);
  });

  test("a press focuses the handle's input", () => {
    const { start, startInput } = renderRegion();
    fireEvent.pointerDown(start, { clientX: 40, pointerId: 1 });
    expect(document.activeElement).toBe(startInput);
  });

  const cases: [string, Partial<KeyboardEventInit>, [number, number]][] = [
    ["ArrowRight", {}, [21, 60]],
    ["ArrowLeft", {}, [19, 60]],
    ["ArrowRight", { shiftKey: true }, [30, 60]],
    ["PageDown", {}, [10, 60]],
    ["Home", {}, [0, 60]],
    ["End", {}, [59, 60]],
  ];

  for (const [key, init, expected] of cases) {
    test(`${init.shiftKey ? "Shift+" : ""}${key} on the start handle gives ${expected.join("–")} and commits`, () => {
      const { onValueChange, onValueCommitted, startInput } = renderRegion();
      fireEvent.keyDown(startInput, { key, ...init });
      expect(lastCall(onValueChange)).toEqual([
        expected,
        expect.objectContaining({ edge: "start", reason: "keyboard" }),
      ]);
      expect(lastCall(onValueCommitted)[0]).toEqual(expected);
    });
  }

  test("the end handle moves the end edge from the keyboard", () => {
    const { endInput, span } = renderRegion();
    fireEvent.keyDown(endInput, { key: "End" });
    expect(span()).toEqual(["20%", "80%"]);
  });

  test("must be used within a region", () => {
    expect(() =>
      render(
        <Waveform.Root>
          <Waveform.RegionHandle edge="start" />
        </Waveform.Root>
      )
    ).toThrow("Waveform.RegionHandle must be used within Waveform.Region");
  });
});
