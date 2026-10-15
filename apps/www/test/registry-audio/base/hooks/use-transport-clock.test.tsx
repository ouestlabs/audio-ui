import { describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";

// The shared audio context, with a clock the test moves by hand.
const context = { currentTime: 0 };
mock.module("@/registry-audio/bases/base/lib/web-audio", () => ({
  webAudio: { getContext: () => context },
}));

const { useTransportClock } = await import(
  "@/registry-audio/bases/base/hooks/use-transport-clock"
);

const setup = (bpm: number) =>
  renderHook(
    (props: { bpm: number }) =>
      useTransportClock({ bpm: props.bpm, totalSteps: 16 }),
    { initialProps: { bpm } }
  );

describe("useTransportClock getPosition", () => {
  test("keeps its place when the tempo changes while it plays", () => {
    context.currentTime = 0;
    const view = setup(120);
    act(() => view.result.current.start());

    // 120 BPM in sixteenths is 0.125 s a step: 3 s is 24 steps, step 8 of the loop.
    context.currentTime = 3;
    expect(view.result.current.getPosition()).toBe(8);

    // Halve the tempo: the playhead stays where it is, then counts at 0.25 s a step.
    view.rerender({ bpm: 60 });
    expect(view.result.current.getPosition()).toBe(8);
    context.currentTime = 3.5;
    expect(view.result.current.getPosition()).toBe(10);

    act(() => view.result.current.stop());
  });

  test("a tempo change while stopped leaves the start where it was", () => {
    context.currentTime = 5;
    const view = setup(120);
    view.rerender({ bpm: 60 });
    expect(view.result.current.getPosition()).toBe(0);
  });

  test("a render at the same tempo does not move it", () => {
    context.currentTime = 0;
    const view = setup(120);
    act(() => view.result.current.start());
    context.currentTime = 1;
    const before = view.result.current.getPosition();
    view.rerender({ bpm: 120 });
    expect(view.result.current.getPosition()).toBe(before);
    act(() => view.result.current.stop());
  });
});
