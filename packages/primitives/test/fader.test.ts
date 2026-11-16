import { describe, expect, mock, test } from "bun:test";
import { fader } from "../src/fader/index.ts";

/** The fader with no framework: the kernel's instance, driven through its api. */
function instance(options: Record<string, unknown> = {}) {
  const onValueChange = mock(
    (_value: number, _details: { reason: string }) => undefined
  );
  const onValueCommitted = mock(
    (_value: number, _details: { reason: string }) => undefined
  );
  const faderInstance = fader({
    id: "f",
    onValueChange,
    onValueCommitted,
    ...options,
  } as never);
  return { faderInstance, onValueChange, onValueCommitted };
}

describe("the fader primitive", () => {
  test("starts at the midpoint of -60 to +6 and shows where it sits", () => {
    const { faderInstance } = instance();
    expect(faderInstance.get().view.value).toBe(-27);
    expect(faderInstance.get().view.share).toBeCloseTo(50, 5);
  });

  test("setValue reports one change and one commit", () => {
    const { faderInstance, onValueChange, onValueCommitted } = instance();
    faderInstance.api.setValue(-6);
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([-6]);
    expect(onValueCommitted.mock.calls.map(([value]) => value)).toEqual([-6]);
    expect(faderInstance.get().view.value).toBe(-6);
  });

  test("a change an app refuses is not applied", () => {
    const { faderInstance } = instance({
      onValueChange: (_value: number, details: { cancel: () => void }) =>
        details.cancel(),
    });
    faderInstance.api.setValue(-6);
    expect(faderInstance.get().view.value).toBe(-27);
  });

  test("a controlled value follows the options it is given", () => {
    const { faderInstance } = instance({ value: -20 });
    expect(faderInstance.get().view.value).toBe(-20);
    faderInstance.setOptions({ id: "f", value: 0 });
    expect(faderInstance.get().view.value).toBe(0);
  });
});
