import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers.js";
import { Waveform } from "../../../../entries/waveform.js";
import { lastCall } from "../helpers.js";

/**
 * A 100-second source shown from 20 to 60 over a 200px control: 5px per
 * second of the stretch shown.
 */
function renderWindow(props: Waveform.Root.Props = {}) {
  const onValueChange = mock(
    (_value: number, _details: Waveform.Root.ChangeEventDetails) => undefined
  );
  const view = render(
    <Waveform.Root
      data-testid="root"
      duration={100}
      onValueChange={onValueChange}
      range={[20, 60]}
      {...props}
    >
      <Waveform.Control aria-label="Seek" data-testid="control">
        <Waveform.Marker data-testid="marker" value={30} />
        <Waveform.Hover data-testid="hover" />
        <Waveform.Region data-testid="region" defaultValue={[30, 40]} />
      </Waveform.Control>
    </Waveform.Root>
  );
  const control = view.getByTestId("control");
  mockRect(control, { bottom: 40, height: 40, right: 200, width: 200 });
  const root = view.getByTestId("root");
  return {
    control,
    input: view.getByRole("slider") as HTMLInputElement,
    onValueChange,
    position: () => root.style.getPropertyValue("--waveform-position"),
    root,
    view,
  };
}

describe("Waveform.Root range", () => {
  test("places the position across the stretch shown", () => {
    expect(renderWindow({ value: 30 }).position()).toBe("25%");
  });

  test("marks a position outside the stretch, holding the playhead at its edge", () => {
    const { position, root } = renderWindow({ value: 80 });
    expect(position()).toBe("100%");
    expect(root.hasAttribute("data-outside")).toBe(true);
  });

  test("is not outside while within the stretch", () => {
    expect(renderWindow({ value: 40 }).root.hasAttribute("data-outside")).toBe(
      false
    );
  });

  test("a press seeks within the stretch", () => {
    const { control, onValueChange } = renderWindow();
    fireEvent.pointerDown(control, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(lastCall(onValueChange)[0]).toBe(40);
  });

  test("the input and its keys stay within the stretch", () => {
    const { input, onValueChange } = renderWindow({ defaultValue: 30 });
    expect([input.min, input.max]).toEqual(["20", "60"]);
    fireEvent.keyDown(input, { key: "Home" });
    expect(lastCall(onValueChange)[0]).toBe(20);
    fireEvent.keyDown(input, { key: "End" });
    expect(lastCall(onValueChange)[0]).toBe(60);
    fireEvent.keyDown(input, { key: "PageUp" });
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  test("hover, markers and regions follow the stretch", () => {
    const { control, view } = renderWindow();
    expect(view.getByTestId("marker").style.left).toBe("25%");
    const region = view.getByTestId("region");
    expect([region.style.left, region.style.width]).toEqual(["25%", "25%"]);
    fireEvent.pointerMove(control, { clientX: 50, clientY: 20, pointerId: 1 });
    expect(view.getByTestId("hover").style.left).toBe("25%");
  });

  test("dragging a region is measured in the stretch's seconds per px", () => {
    const { view } = renderWindow();
    const region = view.getByTestId("region");
    fireEvent.pointerDown(region, { clientX: 70, pointerId: 1 });
    fireEvent.pointerMove(region, { clientX: 95, pointerId: 1 });
    fireEvent.pointerUp(region, { clientX: 95, pointerId: 1 });
    // 25px at 5px per second
    expect(region.style.left).toBe("37.5%");
  });

  test("an empty or backwards stretch shows the whole audio", () => {
    expect(renderWindow({ range: [50, 50], value: 25 }).position()).toBe("25%");
  });
});

describe("Waveform min/max peaks", () => {
  test("bars draw how far each slice reaches either way", () => {
    const view = render(
      <Waveform.Root peaks={{ max: [0.2, 0.3], min: [-0.8, -0.1] }}>
        <Waveform.Bars count={2} data-testid="bars" minLevel={0} />
      </Waveform.Root>
    );
    const levels = [...view.getByTestId("bars").children].map((bar) =>
      Number((bar as HTMLElement).style.getPropertyValue("--waveform-level"))
    );
    expect(levels.map((level) => Math.round(level * 100) / 100)).toEqual([
      0.8, 0.3,
    ]);
  });

  test("bars show only the stretch shown", () => {
    const view = render(
      <Waveform.Root duration={4} peaks={[0.1, 0.2, 0.7, 0.9]} range={[2, 4]}>
        <Waveform.Bars count={2} data-testid="bars" minLevel={0} />
      </Waveform.Root>
    );
    const levels = [...view.getByTestId("bars").children].map((bar) =>
      Number((bar as HTMLElement).style.getPropertyValue("--waveform-level"))
    );
    expect(levels.map((level) => Math.round(level * 100) / 100)).toEqual([
      0.7, 0.9,
    ]);
  });
});
