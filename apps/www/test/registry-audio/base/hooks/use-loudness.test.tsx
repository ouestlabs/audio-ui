import { describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";

/** A meter that does nothing but say it was let go of. */
const meter = {
  clear: () => undefined,
  disposed: 0,
  dispose: () => {
    meter.disposed += 1;
  },
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
  test("lets go of its meter when the signal's owner already cut the link to it", async () => {
    // The mixer that owns the tap disposes of its nodes first: the link to the meter is gone, and Web Audio refuses to cut it again.
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
    expect(meter.disposed).toBe(1);
  });
});
