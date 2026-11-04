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
