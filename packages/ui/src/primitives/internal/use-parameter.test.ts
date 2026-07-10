import { describe, expect, mock, test } from "bun:test";
import type { Point } from "@audio-ui/utils";
import { act, fireEvent, renderHook } from "@testing-library/react";
import type { UseParameterOptions } from "./use-parameter";
import { useParameter } from "./use-parameter";

function keyEvent(key: string) {
  return { key, preventDefault: () => {} } as React.KeyboardEvent;
}

function pointerEvent(clientX: number, clientY: number) {
  return { clientX, clientY, preventDefault: () => {} } as React.PointerEvent;
}

function renderParameter(options: Partial<UseParameterOptions> = {}) {
  const onValueChange = mock(() => {});
  const onValueCommit = mock(() => {});
  const hook = renderHook(
    (props: Partial<UseParameterOptions>) =>
      useParameter({
        max: 100,
        min: 0,
        onValueChange,
        onValueCommit,
        step: 1,
        ...props,
      }),
    { initialProps: options }
  );
  return { hook, onValueChange, onValueCommit };
}

describe("useParameter value semantics", () => {
  test("defaults to the midpoint of min/max", () => {
    const { hook } = renderParameter();
    expect(hook.result.current.value).toBe(50);
    expect(hook.result.current.percentage).toBe(0.5);
  });

  test("clamps controlled values and treats NaN as min", () => {
    const { hook } = renderParameter({ value: 400 });
    expect(hook.result.current.value).toBe(100);
    hook.rerender({ value: Number.NaN });
    expect(hook.result.current.value).toBe(0);
  });

  test("updateValue clamps and quantizes before notifying", () => {
    const { hook, onValueChange, onValueCommit } = renderParameter({
      step: 5,
    });
    act(() => {
      hook.result.current.updateValue(87);
    });
    expect(onValueChange).toHaveBeenLastCalledWith(85);
    expect(onValueCommit).not.toHaveBeenCalled();
  });

  test("commitValue notifies change and commit with the stepped value", () => {
    const { hook, onValueChange, onValueCommit } = renderParameter();
    act(() => {
      hook.result.current.commitValue(230);
    });
    expect(onValueChange).toHaveBeenLastCalledWith(100);
    expect(onValueCommit).toHaveBeenCalledTimes(1);
    expect(onValueCommit).toHaveBeenLastCalledWith(100);
  });

  test("percentage guards against a zero-width range", () => {
    const { hook } = renderParameter({ max: 0, min: 0 });
    expect(hook.result.current.percentage).toBe(0);
  });
});

describe("useParameter keyboard", () => {
  const cases: [string, number][] = [
    ["ArrowUp", 51],
    ["ArrowRight", 51],
    ["ArrowDown", 49],
    ["ArrowLeft", 49],
    ["Home", 0],
    ["End", 100],
    ["PageUp", 60],
    ["PageDown", 40],
  ];

  for (const [key, expected] of cases) {
    test(`${key} commits ${expected} from 50`, () => {
      const { hook, onValueCommit } = renderParameter();
      act(() => {
        hook.result.current.keyboardProps.onKeyDown(keyEvent(key));
      });
      expect(onValueCommit).toHaveBeenLastCalledWith(expected);
    });
  }

  test("does nothing when disabled", () => {
    const { hook, onValueCommit } = renderParameter({ disabled: true });
    act(() => {
      hook.result.current.keyboardProps.onKeyDown(keyEvent("ArrowUp"));
    });
    expect(onValueCommit).not.toHaveBeenCalled();
  });
});

describe("useParameter wheel", () => {
  test("commits ±step per wheel tick and ignores sub-threshold deltas", () => {
    const { hook, onValueCommit } = renderParameter();
    const node = document.createElement("div");
    document.body.appendChild(node);
    act(() => {
      hook.result.current.wheelRef(node);
    });
    // useWheel arms its listener in an effect; in the primitives the ref
    // attaches during render, so re-run the effect to match that timing.
    hook.rerender({ disabled: true });
    hook.rerender({});

    fireEvent.wheel(node, { deltaY: -100 });
    expect(onValueCommit).toHaveBeenLastCalledWith(51);

    fireEvent.wheel(node, { deltaY: 0.05 });
    expect(onValueCommit).toHaveBeenCalledTimes(1);
    node.remove();
  });
});

describe("useParameter assembled drag", () => {
  const geometry = {
    deltaToValue: (delta: Point, startValue: number) => startValue + delta.x,
    pointToValue: (point: Point) => point.x,
  };

  test("start jumps to the pointed value, drag streams, end commits pending", () => {
    const { hook, onValueChange, onValueCommit } = renderParameter(geometry);
    act(() => {
      hook.result.current.dragCallbacks.onDragStart(pointerEvent(30, 0));
    });
    expect(onValueChange).toHaveBeenLastCalledWith(30);
    expect(hook.result.current.isDragging).toBe(true);

    act(() => {
      hook.result.current.dragCallbacks.onDrag({ x: 25, y: 0 });
    });
    expect(onValueChange).toHaveBeenLastCalledWith(55);

    act(() => {
      hook.result.current.dragCallbacks.onDragEnd();
    });
    expect(onValueCommit).toHaveBeenLastCalledWith(55);
    expect(hook.result.current.isDragging).toBe(false);
  });

  test("onDrag keeps the single-parameter arity usePointerDrag sniffs", () => {
    const { hook } = renderParameter(geometry);
    expect(hook.result.current.dragCallbacks.onDrag.length).toBe(1);
  });

  test("falls back to the current value when geometry answers null", () => {
    const { hook, onValueChange } = renderParameter({
      pointToValue: () => null,
    });
    act(() => {
      hook.result.current.dragCallbacks.onDragStart(pointerEvent(30, 0));
    });
    expect(onValueChange).toHaveBeenLastCalledWith(50);
  });
});

describe("useParameter freezeWhileDragging", () => {
  test("displayValue follows the drag while the controlled value lags, then clears", () => {
    const { hook } = renderParameter({
      freezeWhileDragging: true,
      pointToValue: (point: Point) => point.x,
      value: 10,
    });
    act(() => {
      hook.result.current.dragCallbacks.onDragStart(pointerEvent(30, 0));
    });
    expect(hook.result.current.value).toBe(10);
    expect(hook.result.current.displayValue).toBe(30);

    act(() => {
      hook.result.current.dragCallbacks.onDragEnd();
    });
    expect(hook.result.current.displayValue).toBe(10);
  });
});

describe("useParameter outside-click commit", () => {
  test("a pointerdown outside the control mid-drag commits the pending value", () => {
    const { hook, onValueCommit } = renderParameter({
      containsTarget: () => false,
      pointToValue: (point: Point) => point.x,
    });
    act(() => {
      hook.result.current.dragCallbacks.onDragStart(pointerEvent(30, 0));
    });
    expect(onValueCommit).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    expect(onValueCommit).toHaveBeenLastCalledWith(30);
  });
});

describe("useParameter granular ops (Knob path)", () => {
  test("beginDrag/dragTo/endDrag support a custom final value", () => {
    const { hook, onValueChange, onValueCommit } = renderParameter();
    act(() => {
      hook.result.current.beginDrag(50);
    });
    expect(hook.result.current.isDragging).toBe(true);

    act(() => {
      hook.result.current.dragTo(72);
    });
    expect(onValueChange).toHaveBeenLastCalledWith(72);

    act(() => {
      hook.result.current.endDrag(50);
    });
    expect(onValueCommit).toHaveBeenLastCalledWith(50);
    expect(hook.result.current.isDragging).toBe(false);
  });
});
