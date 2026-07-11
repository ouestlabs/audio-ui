import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { Multislider } from "./multislider";

/** Integer domain (0-100, step 1) so paint/keyboard assertions stay exact. */
function renderMultislider(props: Multislider.RootProps = {}) {
  const onValueChange = mock(() => undefined);
  const onValueCommit = mock(() => undefined);
  const view = render(
    <Multislider.Root
      defaultValue={[50, 50, 50, 50]}
      max={100}
      min={0}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      step={1}
      {...props}
    >
      <Multislider.Track data-testid="track">
        <Multislider.Sliders>
          {(_value, index) => (
            <Multislider.Slider index={index} key={index}>
              <Multislider.Fill data-testid={`fill-${index}`} />
              <Multislider.Thumb data-testid={`thumb-${index}`} />
            </Multislider.Slider>
          )}
        </Multislider.Sliders>
      </Multislider.Track>
    </Multislider.Root>
  );
  return {
    onValueChange,
    onValueCommit,
    sliders: view.getAllByRole("slider"),
    track: view.getByTestId("track"),
    view,
  };
}

describe("Multislider value semantics", () => {
  test("renders one slider per array entry with group and slider semantics", () => {
    const { track, sliders } = renderMultislider();
    expect(track.getAttribute("role")).toBe("group");
    expect(track.getAttribute("aria-label")).toBe("Multislider");
    expect(sliders).toHaveLength(4);
    expect(sliders[0]?.getAttribute("aria-valuenow")).toBe("50");
    expect(sliders[0]?.getAttribute("aria-valuemin")).toBe("0");
    expect(sliders[0]?.getAttribute("aria-valuemax")).toBe("100");
  });

  test("slider count follows the controlled array length", () => {
    const { sliders } = renderMultislider({ value: [10, 20, 30] });
    expect(sliders).toHaveLength(3);
    expect(sliders[2]?.getAttribute("aria-valuenow")).toBe("30");
  });

  test("clamps out-of-range controlled values per slider", () => {
    const { sliders } = renderMultislider({ value: [150, -20] });
    expect(sliders[0]?.getAttribute("aria-valuenow")).toBe("100");
    expect(sliders[1]?.getAttribute("aria-valuenow")).toBe("0");
  });

  test("treats a NaN entry as min", () => {
    const { sliders } = renderMultislider({ value: [Number.NaN, 50] });
    expect(sliders[0]?.getAttribute("aria-valuenow")).toBe("0");
  });

  test("scales each fill from its own value", () => {
    const { view } = renderMultislider({ value: [25, 75] });
    expect(view.getByTestId("fill-0").style.transform).toBe("scaleY(0.25)");
    expect(view.getByTestId("fill-1").style.transform).toBe("scaleY(0.75)");
  });
});

describe("Multislider keyboard (vertical)", () => {
  test("ArrowUp/ArrowDown adjust only the focused slider", () => {
    const { sliders, onValueCommit } = renderMultislider();
    fireEvent.keyDown(sliders[1] as HTMLElement, { key: "ArrowUp" });
    expect(onValueCommit).toHaveBeenLastCalledWith([50, 51, 50, 50]);
    fireEvent.keyDown(sliders[1] as HTMLElement, { key: "ArrowDown" });
    expect(onValueCommit).toHaveBeenLastCalledWith([50, 50, 50, 50]);
  });

  test("Home/End/PageUp/PageDown follow the fader key map per slider", () => {
    const { sliders, onValueCommit } = renderMultislider();
    fireEvent.keyDown(sliders[2] as HTMLElement, { key: "Home" });
    expect(onValueCommit).toHaveBeenLastCalledWith([50, 50, 0, 50]);
    fireEvent.keyDown(sliders[2] as HTMLElement, { key: "End" });
    expect(onValueCommit).toHaveBeenLastCalledWith([50, 50, 100, 50]);
    fireEvent.keyDown(sliders[0] as HTMLElement, { key: "PageUp" });
    expect(onValueCommit).toHaveBeenLastCalledWith([60, 50, 100, 50]);
  });

  test("ArrowRight/ArrowLeft move the roving focus between sliders", () => {
    const { sliders } = renderMultislider();
    expect(sliders[0]?.tabIndex).toBe(0);
    expect(sliders[1]?.tabIndex).toBe(-1);

    fireEvent.keyDown(sliders[0] as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(sliders[1] as HTMLElement);
    expect(sliders[1]?.tabIndex).toBe(0);
    expect(sliders[0]?.tabIndex).toBe(-1);

    fireEvent.keyDown(sliders[1] as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(sliders[0] as HTMLElement);
  });

  test("focus movement clamps at the edges", () => {
    const { sliders } = renderMultislider();
    fireEvent.keyDown(sliders[0] as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(sliders[0] as HTMLElement);
  });

  test("ignores keys when disabled", () => {
    const { sliders, onValueCommit } = renderMultislider({ disabled: true });
    fireEvent.keyDown(sliders[0] as HTMLElement, { key: "ArrowUp" });
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(sliders[0]?.tabIndex).toBe(-1);
  });
});

describe("Multislider keyboard (horizontal)", () => {
  test("value keys and focus keys swap axes", () => {
    const { sliders, onValueCommit } = renderMultislider({
      orientation: "horizontal",
    });
    fireEvent.keyDown(sliders[0] as HTMLElement, { key: "ArrowRight" });
    expect(onValueCommit).toHaveBeenLastCalledWith([51, 50, 50, 50]);

    fireEvent.keyDown(sliders[0] as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(sliders[1] as HTMLElement);
  });
});

describe("Multislider paint (track 200×100, 4 columns)", () => {
  test("pointer down paints the touched column at the pointed value", () => {
    const { track, onValueChange } = renderMultislider();
    mockRect(track, { height: 100, width: 200 });

    fireEvent.pointerDown(track, { clientX: 25, clientY: 25, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([75, 50, 50, 50]);
  });

  test("dragging across columns interpolates every crossed slider and commits on release", () => {
    const { track, onValueChange, onValueCommit } = renderMultislider();
    mockRect(track, { height: 100, width: 200 });

    fireEvent.pointerDown(track, { clientX: 25, clientY: 25, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 175, clientY: 75, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([75, 58, 42, 25]);

    fireEvent.pointerUp(track, { clientX: 175, clientY: 75, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith([75, 58, 42, 25]);
  });

  test("horizontal orientation maps rows from y and values from x", () => {
    const { track, onValueChange } = renderMultislider({
      orientation: "horizontal",
    });
    mockRect(track, { height: 200, width: 100 });

    fireEvent.pointerDown(track, { clientX: 75, clientY: 25, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([75, 50, 50, 50]);
  });

  test("ignores pointer input when disabled", () => {
    const { track, onValueChange } = renderMultislider({ disabled: true });
    mockRect(track, { height: 100, width: 200 });

    fireEvent.pointerDown(track, { clientX: 25, clientY: 25, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Multislider wheel", () => {
  test("wheel over a slider adjusts only that slider", () => {
    const { sliders, onValueCommit } = renderMultislider();
    fireEvent.wheel(sliders[2] as HTMLElement, { deltaY: -100 });
    expect(onValueCommit).toHaveBeenLastCalledWith([50, 50, 51, 50]);
    fireEvent.wheel(sliders[2] as HTMLElement, { deltaY: 100 });
    expect(onValueCommit).toHaveBeenLastCalledWith([50, 50, 50, 50]);
  });
});
