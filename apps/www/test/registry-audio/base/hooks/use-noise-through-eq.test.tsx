import { describe, expect, mock, test } from "bun:test";
import type { EqBand } from "@audio-ui/core/analysis";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

/** A parameter that keeps the value it was last set to, outright or by a ramp. */
const param = (value: number) => ({
  setTargetAtTime(target: number) {
    this.value = target;
  },
  value,
});
const node = () => ({
  connect: (to: unknown) => to,
  disconnect: () => undefined,
});
const filters: {
  Q: { value: number };
  frequency: { value: number };
  gain: { value: number };
}[] = [];

// The shared context, with filters that start at the defaults of Web Audio's.
const context = {
  createAnalyser: () => ({ ...node(), fftSize: 0, smoothingTimeConstant: 0 }),
  createBiquadFilter: () => {
    const filter = {
      ...node(),
      frequency: param(350),
      gain: param(0),
      Q: param(1),
      type: "",
    };
    filters.push(filter);
    return filter;
  },
  createBuffer: (_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  }),
  createBufferSource: () => ({
    ...node(),
    buffer: null,
    loop: false,
    start: () => undefined,
    stop: () => undefined,
  }),
  createGain: () => ({ ...node(), gain: param(1) }),
  currentTime: 0,
  destination: node(),
  resume: () => Promise.resolve(),
  sampleRate: 100,
};
mock.module("@/registry-audio/bases/base/lib/web-audio", () => ({
  webAudio: { getContext: () => context },
}));

const { AudioSessionProvider } = await import(
  "@/registry-audio/bases/base/hooks/use-audio-session"
);
const { usePlaySwitch } = await import(
  "@/registry-audio/bases/base/hooks/use-play-switch"
);
const { useNoiseThroughEq } = await import(
  "@/registry-audio/bases/base/hooks/use-noise-through-eq"
);

const BANDS: EqBand[] = [
  { frequency: 120, gainDb: 6, q: 0.7, type: "lowshelf" },
  { frequency: 2400, gainDb: -4, q: 2, type: "peak" },
];

const wrapper = ({ children }: { children: ReactNode }) => (
  <AudioSessionProvider>{children}</AudioSessionProvider>
);

describe("useNoiseThroughEq", () => {
  test("the filters play the bands from the moment the noise starts, before a band moves", () => {
    filters.length = 0;
    const view = renderHook(
      () => ({ eq: useNoiseThroughEq(BANDS), play: usePlaySwitch() }),
      { wrapper }
    );
    act(() => view.result.current.play.setPlaying(true));
    expect(
      filters.map((filter) => [filter.frequency.value, filter.gain.value])
    ).toEqual([
      [120, 6],
      [2400, -4],
    ]);
    expect(filters[1]?.Q.value).toBe(2);
  });
});
