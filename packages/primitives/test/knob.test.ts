import { describe, expect, mock, test } from "bun:test";
import { knob } from "../src/knob/index.ts";

/** The knob with no framework: the kernel's instance, driven through its api. */
function instance(options: Record<string, unknown> = {}) {
  const onValueChange = mock(
    (_value: number, _details: { reason: string; source?: string }) => undefined
  );
  const onValueCommitted = mock(
    (_value: number, _details: { reason: string }) => undefined
  );
  const knobInstance = knob({
    id: "k",
    onValueChange,
    onValueCommitted,
    ...options,
  } as never);
  return { knobInstance, onValueChange, onValueCommitted };
}

describe("the knob primitive", () => {
  test("starts at the midpoint of its range and shows it", () => {
    const { knobInstance } = instance();
    expect(knobInstance.get().view.value).toBe(50);
    expect(knobInstance.get().view.formatted).toBe("50");
  });

  test("setValue reports one change and one commit, and moves the value", () => {
    const { knobInstance, onValueChange, onValueCommitted } = instance();
    (knobInstance.api as { setValue: (value: number) => void }).setValue(72);
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([72]);
    expect(onValueCommitted.mock.calls.map(([value]) => value)).toEqual([72]);
    expect(knobInstance.get().view.value).toBe(72);
  });

  test("a change an app refuses is not applied", () => {
    const { knobInstance } = instance({
      onValueChange: (_value: number, details: { cancel: () => void }) =>
        details.cancel(),
    });
    (knobInstance.api as { setValue: (value: number) => void }).setValue(72);
    expect(knobInstance.get().view.value).toBe(50);
  });

  test("a controlled value follows the options it is given", () => {
    const { knobInstance } = instance({ value: 20 });
    expect(knobInstance.get().view.value).toBe(20);
    knobInstance.setOptions({ id: "k", value: 80 });
    expect(knobInstance.get().view.value).toBe(80);
  });
});
