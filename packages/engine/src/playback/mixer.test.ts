import { describe, expect, test } from "bun:test";
import { gainToDb } from "../analysis/level.ts";
import {
  delayCompensation,
  panGains,
  routedCompensation,
  soloState,
} from "./mixer.ts";

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

describe("groups", () => {
  test("MIX-020: a soloed track keeps the groups it is in heard, and only them", () => {
    const state = soloState([
      { group: null, id: "drums-bus", kind: "track", soloed: false },
      { group: "drums-bus", id: "kick", kind: "track", soloed: true },
      { group: "drums-bus", id: "snare", kind: "track", soloed: false },
      { group: null, id: "bass", kind: "track", soloed: false },
    ]);
    expect(["drums-bus", "kick"].every(state.heard)).toBe(true);
    expect(state.heard("snare")).toBe(false);
    expect(state.heard("bass")).toBe(false);
  });

  test("MIX-020: a soloed group lets every track in it, and in its groups, be heard", () => {
    const state = soloState([
      { group: null, id: "band", kind: "track", soloed: true },
      { group: "band", id: "drums-bus", kind: "track", soloed: false },
      { group: "drums-bus", id: "kick", kind: "track", soloed: false },
      { group: null, id: "vocal", kind: "track", soloed: false },
    ]);
    expect(["band", "drums-bus", "kick"].every(state.heard)).toBe(true);
    expect(state.heard("vocal")).toBe(false);
    expect(state.sends("kick", "reverb")).toBe(true);
  });

  test("MIX-021: every path meets every other on the same frame, through nested groups and sends at any depth", () => {
    const tracks = [
      { group: null, id: "band", latency: 0, sends: [] },
      { group: "band", id: "drums-bus", latency: 20, sends: ["hall"] },
      { group: "drums-bus", id: "kick", latency: 10, sends: [] },
      { group: "drums-bus", id: "snare", latency: 0, sends: ["hall"] },
      { group: null, id: "vocal", latency: 5, sends: ["hall"] },
    ];
    const returns = [{ id: "hall", latency: 50 }];
    const { out, sends, total } = routedCompensation(tracks, returns);
    const byId = new Map(tracks.map((track) => [track.id, track]));
    // When a path's sound leaves its chain, from the frame the arrangement plays.
    const ready = (id: string): number => {
      const inner = tracks.filter((track) => track.group === id);
      const arrives = Math.max(
        0,
        ...inner.map((track) => ready(track.id) + (out.get(track.id) ?? 0))
      );
      return arrives + (byId.get(id)?.latency ?? 0);
    };
    // Into the same group, the same frame.
    expect(ready("kick") + (out.get("kick") ?? 0)).toBe(
      ready("snare") + (out.get("snare") ?? 0)
    );
    // Into the return, the same frame from every depth.
    const atHall = ["drums-bus", "snare", "vocal"].map(
      (id) => ready(id) + (sends.get(id)?.get("hall") ?? 0)
    );
    expect(new Set(atHall).size).toBe(1);
    // At the main track, the top paths and the return meet at the total.
    expect(ready("band") + (out.get("band") ?? 0)).toBe(total);
    expect(ready("vocal") + (out.get("vocal") ?? 0)).toBe(total);
    expect((atHall[0] ?? 0) + 50 + (out.get("hall") ?? 0)).toBe(total);
    expect(total).toBe(80);
  });

  test("MIX-021: with no group, as the two-level compensation was", () => {
    const { out, sends, total } = routedCompensation(
      [
        { id: "a", latency: 100, sends: ["r"] },
        { id: "b", latency: 0, sends: ["r"] },
      ],
      [{ id: "r", latency: 50 }]
    );
    expect(total).toBe(150);
    expect(out.get("a")).toBe(50);
    expect(out.get("b")).toBe(150);
    expect(out.get("r")).toBe(0);
    expect(sends.get("b")?.get("r")).toBe(100);
  });

  test("MIX-021: a group that would hold itself, or a group that is not a track, plays into the main track", () => {
    const { out, total } = routedCompensation(
      [
        { group: "a", id: "a", latency: 10 },
        { group: "nowhere", id: "b", latency: 0 },
      ],
      []
    );
    expect(total).toBe(10);
    expect(out.get("b")).toBe(10);
  });
});
