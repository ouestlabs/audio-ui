import { describe, expect, mock, test } from "bun:test";
import { xypad } from "../src/xypad/index.ts";

/** The XY pad with no framework: the kernel's instance, driven through its api. */
function instance(options: Record<string, unknown> = {}) {
  const onValueChange = mock(
    (_value: { x: number; y: number }, _details: { reason: string }) =>
      undefined
  );
  const onValueCommitted = mock(
    (_value: { x: number; y: number }, _details: { reason: string }) =>
      undefined
  );
  const padInstance = xypad({
    id: "p",
    onValueChange,
    onValueCommitted,
    ...options,
  } as never);
  return { onValueChange, onValueCommitted, padInstance };
}

describe("the XY pad primitive", () => {
  test("starts at the center of its two ranges", () => {
    const { padInstance } = instance();
    expect(padInstance.get().view.value).toEqual({ x: 50, y: 50 });
    expect(padInstance.get().view.percentX).toBe(0.5);
  });

  test("setValue moves both axes, reporting each change", () => {
    const { padInstance, onValueChange } = instance();
    padInstance.api.setValue(20, 80);
    expect(padInstance.get().view.value).toEqual({ x: 20, y: 80 });
    expect(onValueChange.mock.calls.length).toBe(2);
  });

  test("a change an app refuses is not applied", () => {
    const { padInstance } = instance({
      onValueChange: (_value: unknown, details: { cancel: () => void }) =>
        details.cancel(),
    });
    padInstance.api.setValue(20, 80);
    expect(padInstance.get().view.value).toEqual({ x: 50, y: 50 });
  });

  test("a controlled point follows the options it is given", () => {
    const { padInstance } = instance({ value: { x: 10, y: 10 } });
    expect(padInstance.get().view.value).toEqual({ x: 10, y: 10 });
    padInstance.setOptions({ id: "p", value: { x: 90, y: 30 } });
    expect(padInstance.get().view.value).toEqual({ x: 90, y: 30 });
  });
});
