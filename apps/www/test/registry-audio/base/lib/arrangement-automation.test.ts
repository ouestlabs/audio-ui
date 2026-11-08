import { describe, expect, test } from "bun:test";
import {
  type ArrangementTrack,
  deviceParameterKey,
  devicePositions,
  macroIndex,
  parseDeviceParameter,
} from "@/registry-audio/bases/base/lib/arrangement";
import {
  type ArrangementCommand,
  apply,
  createArrangementState,
} from "@/registry-audio/bases/base/lib/arrangement-state";

const ramp = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

function setup() {
  return createArrangementState({
    colors: 5,
    duration: 10,
    initialTracks: [
      {
        automation: {
          [deviceParameterKey("eq", "lowGainDb")]: ramp,
          [deviceParameterKey("comp", "thresholdDb")]: ramp,
          volume: ramp,
        },
        color: 0,
        devices: [
          { device: "audioui.channel-eq", id: "eq", state: {} },
          { device: "audioui.compressor", id: "comp", state: {} },
        ],
        id: "a",
        name: "A",
      },
    ],
    tempo: { beatUnit: 4, beatsPerBar: 4, bpm: 120 },
  });
}

const run = (commands: ArrangementCommand[]) =>
  commands.reduce((state, command) => apply(state, command), setup());

describe("device automation", () => {
  test("AUT-001: a key names a device's parameter, a rack's macros by their number", () => {
    const key = deviceParameterKey("rack-2", "macro-3");
    expect(key).toBe("device:rack-2:macro-3");
    expect(parseDeviceParameter(key)).toEqual({
      device: "rack-2",
      parameter: "macro-3",
    });
    expect(parseDeviceParameter("volume")).toBeNull();
    expect(macroIndex("macro-3")).toBe(2);
    expect(macroIndex("gainDb")).toBe(-1);
  });

  test("AUT-001 and AUT-003: a track's devices stand where their envelopes are, those moved by hand as they are set", () => {
    const track = setup().doc.tracks[0] as ArrangementTrack;
    const positions = devicePositions(track, 0.25);
    expect(positions.get("eq")?.get("lowGainDb")).toBeCloseTo(0.25);
    expect(positions.get("comp")?.get("thresholdDb")).toBeCloseTo(0.25);
    expect(positions.has("volume")).toBe(false);
    const moved = devicePositions(track, 0.25, [
      deviceParameterKey("eq", "lowGainDb"),
    ]);
    expect(moved.has("eq")).toBe(false);
    expect(moved.has("comp")).toBe(true);
  });

  test("AUT-004: a device removed takes its envelopes with it", () => {
    const state = run([{ id: "eq", track: "a", type: "remove-device" }]);
    expect(Object.keys(state.doc.tracks[0]?.automation ?? {}).sort()).toEqual(
      [deviceParameterKey("comp", "thresholdDb"), "volume"].sort()
    );
  });

  test("AUT-004: a duplicated track's envelopes follow its devices under their new ids", () => {
    const state = run([{ id: "a", type: "duplicate-track" }]);
    const [, copy] = state.doc.tracks;
    const [eq = "", comp = ""] =
      copy?.devices?.map((device) => device.id) ?? [];
    expect([eq, comp]).not.toContain("eq");
    expect(Object.keys(copy?.automation ?? {}).sort()).toEqual(
      [
        deviceParameterKey(eq, "lowGainDb"),
        deviceParameterKey(comp, "thresholdDb"),
        "volume",
      ].sort()
    );
  });
});

describe("automation in time", () => {
  // The volume ramps from 0 at 0 s to 1 at 10 s, the arrangement's end.
  const volume = (commands: ArrangementCommand[]) =>
    run(commands).doc.tracks[0]?.automation?.volume ?? [];
  /** The envelope's points as seconds and values, rounded. */
  const inSeconds = (
    points: readonly { x: number; y: number }[],
    duration: number
  ) =>
    points.map(({ x, y }) => [
      Math.round(x * duration * 1000) / 1000,
      Math.round(y * 1000) / 1000,
    ]);

  test("G-006: a longer arrangement keeps every point at its time, the last value held to the new end", () => {
    const state = run([{ duration: 20, type: "set-duration" }]);
    const points = state.doc.tracks[0]?.automation?.volume ?? [];
    expect(inSeconds(points, 20)).toEqual([
      [0, 0],
      [10, 1],
      [20, 1],
    ]);
  });

  test("G-006: a shorter arrangement cuts the envelope at its new end, at the value it had there", () => {
    const state = run([{ duration: 5, type: "set-duration" }]);
    expect(inSeconds(state.doc.tracks[0]?.automation?.volume ?? [], 5)).toEqual(
      [
        [0, 0],
        [5, 0.5],
      ]
    );
  });

  test("G-006: time inserted holds the value across it and moves what follows later", () => {
    // 2 s at 4 s, in a 10 s arrangement: the ramp's end goes past it, so it ends at 10 s at its value there.
    expect(
      inSeconds(volume([{ at: 4, length: 2, type: "insert-time" }]), 10)
    ).toEqual([
      [0, 0],
      [4, 0.4],
      [6, 0.4],
      [10, 0.8],
    ]);
  });

  test("G-006: time taken out closes up the envelope, what followed moved back", () => {
    expect(
      inSeconds(volume([{ from: 2, to: 6, type: "remove-time" }]), 10)
    ).toEqual([
      [0, 0],
      [2, 0.2],
      [2, 0.6],
      [6, 1],
      [10, 1],
    ]);
  });

  test("G-006: the envelopes of the returns and the main track follow time too", () => {
    const state = createArrangementState({
      colors: 5,
      duration: 10,
      initialMain: {
        automation: { volume: ramp },
        color: 0,
        id: "main",
        name: "Main",
      },
      initialTracks: [],
      tempo: { beatUnit: 4, beatsPerBar: 4, bpm: 120 },
    });
    const longer = apply(state, { duration: 20, type: "set-duration" });
    expect(inSeconds(longer.doc.main.automation?.volume ?? [], 20)).toEqual([
      [0, 0],
      [10, 1],
      [20, 1],
    ]);
  });
});

describe("envelopes drawn", () => {
  test("a return's envelope and the main track's are written, not only a track's", () => {
    let state = createArrangementState({
      colors: 5,
      duration: 10,
      initialReturns: [{ color: 0, id: "r", name: "A Reverb" }],
      initialTracks: [],
      tempo: { beatUnit: 4, beatsPerBar: 4, bpm: 120 },
    });
    for (const trackId of ["r", state.doc.main.id]) {
      state = apply(state, {
        parameter: "volume",
        points: ramp,
        trackId,
        type: "change-automation",
      });
    }
    expect(state.doc.returns[0]?.automation?.volume).toEqual(ramp);
    expect(state.doc.main.automation?.volume).toEqual(ramp);
  });
});
