import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers.ts";
import { Timeline } from "../../../../entries/timeline.ts";
import { lastCall } from "../helpers.tsx";

/** A mark at 20 on a 100-unit timeline whose lane is 200px wide: 2px per unit, fitted. */
function renderMark(
  props: Partial<Timeline.Mark.Props> = {},
  rootProps: Timeline.Root.Props = {}
) {
  const onChange = mock(
    (_value: number, _details: Timeline.Mark.ChangeEventDetails) => undefined
  );
  const onCommit = mock(
    (_value: number, _details: Timeline.Mark.CommitEventDetails) => undefined
  );
  const onClick = mock(() => undefined);
  const view = render(
    <Timeline.Root duration={100} {...rootProps}>
      <Timeline.Lane data-testid="lane">
        <Timeline.Mark
          data-testid="mark"
          onValueChange={onChange}
          onValueCommitted={onCommit}
          value={20}
          {...props}
        >
          <button data-testid="button" onClick={onClick} type="button">
            Verse
          </button>
          <input data-testid="field" />
        </Timeline.Mark>
      </Timeline.Lane>
    </Timeline.Root>
  );
  mockRect(view.getByTestId("lane"), { left: 0, width: 200 });
  return {
    button: view.getByTestId("button"),
    field: view.getByTestId("field"),
    mark: view.getByTestId("mark"),
    onChange,
    onClick,
    onCommit,
    view,
  };
}

const POINTER = { button: 0, buttons: 1, pointerId: 1 };

/** Presses `target` at 40px and lets go at `to` px, with `init` on the moves. */
function drag(target: Element, to: number, init: PointerEventInit = {}) {
  fireEvent.pointerDown(target, { ...POINTER, clientX: 40 });
  fireEvent.pointerMove(document, { ...POINTER, ...init, clientX: to });
  fireEvent.pointerUp(document, { ...POINTER, buttons: 0, clientX: to });
}

describe("Timeline.Mark", () => {
  test("a drag moves it, and commits once where it landed", () => {
    const { button, mark, onChange, onCommit } = renderMark();
    fireEvent.pointerDown(button, { ...POINTER, clientX: 40 });
    expect(mark.hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerMove(document, { ...POINTER, clientX: 80 });
    expect(lastCall(onChange)[0]).toBe(40);
    // It follows the drag though the host has not moved it yet.
    expect(mark.style.getPropertyValue("--timeline-offset")).toBe("40");
    fireEvent.pointerUp(document, { ...POINTER, buttons: 0, clientX: 80 });
    expect(mark.hasAttribute("data-dragging")).toBe(false);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(lastCall(onCommit)[0]).toBe(40);
    expect(lastCall(onCommit)[1].reason).toBe("drag");
  });

  test("a drag lands on the grid unless Cmd/Ctrl is held", () => {
    const grid = { snapStep: 10 };
    const on = renderMark({}, grid);
    drag(on.button, 53);
    expect(lastCall(on.onCommit)[0]).toBe(30);
    on.view.unmount();
    const off = renderMark({}, grid);
    drag(off.button, 53, { ctrlKey: true });
    expect(lastCall(off.onCommit)[0]).toBe(26.5);
  });

  test("a drag lands on a snap point within reach, not on where it started", () => {
    const { button, onCommit } = renderMark(
      {},
      { snapPoints: [20, 30], zoom: 2 }
    );
    drag(button, 56);
    expect(lastCall(onCommit)[0]).toBe(30);
  });

  test("it stays on the timeline", () => {
    const { button, onCommit } = renderMark();
    drag(button, -400);
    expect(lastCall(onCommit)[0]).toBe(0);
  });

  test("a press that stays one clicks, and moves nothing", () => {
    const { button, onChange, onClick, onCommit } = renderMark();
    drag(button, 41);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  test("a drag does not click, and the next press does", () => {
    const { button, onClick } = renderMark();
    drag(button, 80);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("Left and Right on what is inside it move it by its step", () => {
    const { button, onCommit } = renderMark({ step: 5 });
    fireEvent.keyDown(button, { key: "ArrowRight" });
    expect(lastCall(onCommit)[0]).toBe(25);
    expect(lastCall(onCommit)[1].reason).toBe("keyboard");
  });

  test("other keys, modifiers and a field keep theirs", () => {
    const { button, field, onChange } = renderMark({ step: 5 });
    fireEvent.keyDown(button, { key: "ArrowUp" });
    fireEvent.keyDown(button, { altKey: true, key: "ArrowRight" });
    fireEvent.keyDown(button, { key: "ArrowRight", metaKey: true });
    fireEvent.keyDown(field, { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
  });

  test("a press in a field does not drag it", () => {
    const { field, mark } = renderMark();
    fireEvent.pointerDown(field, { ...POINTER, clientX: 40 });
    expect(mark.hasAttribute("data-dragging")).toBe(false);
  });

  test("a disabled timeline's mark stays put", () => {
    const { button, onChange } = renderMark({}, { disabled: true });
    drag(button, 80);
    fireEvent.keyDown(button, { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
  });

  test("with no listeners it is only placed, and a press goes through it", () => {
    const onPress = mock(() => undefined);
    const view = render(
      <Timeline.Root duration={100}>
        <div onPointerDown={onPress}>
          <Timeline.Mark data-testid="mark" value={20}>
            1
          </Timeline.Mark>
        </div>
      </Timeline.Root>
    );
    fireEvent.pointerDown(view.getByTestId("mark"), { button: 0 });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(
      view.getByTestId("mark").style.getPropertyValue("--timeline-offset")
    ).toBe("20");
  });
});
