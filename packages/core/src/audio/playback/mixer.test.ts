import { describe, expect, test } from "bun:test";
import { gainToDb } from "../analysis/level.ts";
import { delayCompensation, panGains, soloState } from "./mixer.ts";

describe("the pan law", () => {
  test("MIX-003: 0 dB on both channels at the centre", () => {
    const [left, right] = panGains(0);
    expect(left).toBeCloseTo(1, 12);
    expect(right).toBeCloseTo(1, 12);
  });

  test("MIX-003: +3 dB on the side it is turned to, silence on the other, at either end", () => {
    const [left, right] = panGains(-1);
    expect(gainToDb(left)).toBeCloseTo(3.0103, 4);
    expect(right).toBeCloseTo(0, 12);
    const [, hardRight] = panGains(1);
    expect(gainToDb(hardRight)).toBeCloseTo(3.0103, 4);
  });

  test("MIX-003: constant power all the way", () => {
    for (const pan of [-0.8, -0.3, 0.2, 0.9]) {
      const [left, right] = panGains(pan);
      expect(left * left + right * right).toBeCloseTo(2, 12);
    }
  });
});

describe("solo", () => {
  const tracks = [
    { id: "drums", kind: "track", soloed: false },
    { id: "bass", kind: "track", soloed: false },
    { id: "reverb", kind: "return", soloed: false },
  ] as const;
  const solo = (ids: string[], inPlace = true) =>
    soloState(
      tracks.map((track) => ({ ...track, soloed: ids.includes(track.id) })),
      { inPlace }
    );

  test("MIX-005: nothing soloed, everything plays", () => {
    const state = solo([]);
    expect(["drums", "bass", "reverb"].every(state.heard)).toBe(true);
    expect(state.sends("bass", "reverb")).toBe(true);
  });

  test("MIX-005: a soloed track is heard, the others are silenced with their sends", () => {
    const state = solo(["drums"]);
    expect(state.heard("drums")).toBe(true);
    expect(state.heard("bass")).toBe(false);
    expect(state.sends("drums", "reverb")).toBe(true);
    expect(state.sends("bass", "reverb")).toBe(false);
  });

  test("MIX-006: with solo in place the returns stay heard, without it they go", () => {
    expect(solo(["drums"]).heard("reverb")).toBe(true);
    expect(solo(["drums"], false).heard("reverb")).toBe(false);
  });

  test("MIX-006: a soloed return is heard with what every track sends it", () => {
    const state = solo(["reverb"]);
    expect(state.heard("reverb")).toBe(true);
    expect(state.heard("drums")).toBe(false);
    expect(state.sends("bass", "reverb")).toBe(true);
  });
});

describe("delay compensation", () => {
  test("MIX-012: every path reaches the main track on the same frame", () => {
    const tracks = [
      { id: "vocals", latency: 240 },
      { id: "drums", latency: 0 },
      { id: "bass", latency: 64 },
    ];
    const returns = [
      { id: "reverb", latency: 0 },
      { id: "delay", latency: 100 },
    ];
    const plan = delayCompensation(tracks, returns);
    expect(plan.total).toBe(340);
    for (const track of tracks) {
      const wait = plan.tracks.get(track.id);
      // A track's own output.
      expect(track.latency + (wait?.chain ?? 0) + (wait?.main ?? 0)).toBe(
        plan.total
      );
      // The same track through each return.
      for (const send of returns) {
        expect(
          track.latency +
            (wait?.chain ?? 0) +
            send.latency +
            (plan.returns.get(send.id) ?? 0)
        ).toBe(plan.total);
      }
    }
  });

  test("MIX-012: latencies that are not whole positive frames count as none", () => {
    const plan = delayCompensation(
      [
        { id: "a", latency: Number.NaN },
        { id: "b", latency: -4 },
      ],
      []
    );
    expect(plan.total).toBe(0);
  });
});
