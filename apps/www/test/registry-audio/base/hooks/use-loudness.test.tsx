import { describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";

const disposed: unknown[] = [];
const meter = {
  clear: () => undefined,
  dispose: () => disposed.push(meter),
  input: {},
};

const analysis = await import("@audio-ui/engine/analysis");
mock.module("@audio-ui/engine/analysis", () => ({
  ...analysis,
  createLoudnessMeter: () => Promise.resolve(meter),
}));
const { useLoudness } = await import(
  "@/registry-audio/bases/base/hooks/use-loudness"
);

describe("useLoudness", () => {
  test("unmounting after the signal's owner cut its links still disposes of the meter", async () => {
    // The mixer's dispose ran first: the tap has no link left to the meter.
    const signal = {
      connect: () => undefined,
      context: {},
      disconnect: () => {
        throw new DOMException("not connected", "InvalidAccessError");
      },
    } as unknown as AudioNode;
    const view = renderHook(() => useLoudness(signal));
    await act(() => Promise.resolve());
    expect(() => view.unmount()).not.toThrow();
    expect(disposed).toEqual([meter]);
    expect(view.result.current.source.getSnapshot().integrated).toBe(
      Number.NEGATIVE_INFINITY
    );
  });
});
