import { describe, expect, test } from "bun:test";
import {
  DRUM_RACK_DEVICE,
  type DrumSound,
} from "@/registry-audio/bases/base/lib/arrangement";
import {
  type ArrangementCommand,
  apply,
  createArrangementState,
} from "@/registry-audio/bases/base/lib/arrangement-state";

function setup() {
  return createArrangementState({
    colors: 5,
    duration: 10,
    initialTracks: [
      { color: 0, id: "beat", kind: "midi", name: "Beat" },
      { color: 1, id: "vox", name: "Vox" },
    ],
    tempo: { beatUnit: 4, beatsPerBar: 4, bpm: 120 },
  });
}

type State = ReturnType<typeof setup>;

const addDrums = (track = "beat"): ArrangementCommand => ({
  device: DRUM_RACK_DEVICE,
  instrument: true,
  state: {},
  track,
  type: "add-device",
});
const run = (commands: ArrangementCommand[], from = setup()) =>
  commands.reduce((state, command) => apply(state, command), from);
const drumsOf = (state: State) =>
  state.doc.tracks[0]?.devices?.find(
    (device) => device.device === DRUM_RACK_DEVICE
  );
const padsOf = (state: State) =>
  (drumsOf(state)?.rack?.chains ?? []).map((chain) => ({
    name: chain.name,
    note: chain.pad?.note,
    sound: chain.pad?.sound,
  }));

const clap: DrumSound = {
  decay: 0.4,
  kind: "sample",
  recording: "clap",
  tune: 0,
};

describe("drum racks", () => {
  test("DEV-013: a drum rack goes first on a MIDI track as its instrument, with a kick, a snare and a hat", () => {
    const state = run([addDrums()]);
    const drums = drumsOf(state);
    expect(drums?.instrument).toBe(true);
    expect(state.doc.tracks[0]?.devices?.[0]).toBe(drums as never);
    expect(padsOf(state).map((pad) => [pad.name, pad.note])).toEqual([
      ["Kick", 36],
      ["Snare", 38],
      ["Hat", 42],
    ]);
    expect(drums?.rack?.macros).toHaveLength(8);
    expect(new Set(drums?.rack?.chains.map((chain) => chain.id)).size).toBe(3);
    expect(state.history.past).toHaveLength(1);
  });

  test("DEV-013: an audio track takes no drum rack", () => {
    const state = run([addDrums("vox")]);
    expect(state.doc.tracks[1]?.devices ?? []).toEqual([]);
  });

  test("DEV-013: a sound put on an empty note makes a pad; on a pad, it takes its place and keeps its devices", () => {
    const base = run([addDrums()]);
    const rack = drumsOf(base)?.id as string;
    const snare = drumsOf(base)?.rack?.chains[1]?.id as string;
    const state = run(
      [
        {
          device: "audioui.reverb",
          state: {},
          track: "beat",
          type: "add-device",
          chain: { chain: snare, rack },
        },
        {
          name: "Clap",
          note: 39,
          rack,
          sound: clap,
          track: "beat",
          type: "set-pad",
        },
        {
          name: "Clap",
          note: 38,
          rack,
          sound: clap,
          track: "beat",
          type: "set-pad",
        },
      ],
      base
    );
    expect(padsOf(state).map((pad) => [pad.name, pad.note])).toEqual([
      ["Kick", 36],
      ["Clap", 38],
      ["Hat", 42],
      ["Clap", 39],
    ]);
    expect(padsOf(state)[1]?.sound).toEqual(clap);
    expect(
      drumsOf(state)?.rack?.chains[1]?.devices.map((device) => device.device)
    ).toEqual(["audioui.reverb"]);
  });

  test("DEV-013: a drag of a pad's knob is one step, kept within its travel", () => {
    const base = run([addDrums()]);
    const rack = drumsOf(base)?.id as string;
    const kick = drumsOf(base)?.rack?.chains[0]?.id as string;
    const state = run(
      [
        { chain: kick, rack, track: "beat", tune: -3, type: "change-pad" },
        { chain: kick, rack, track: "beat", tune: -60, type: "change-pad" },
        { chain: kick, decay: 0, rack, track: "beat", type: "change-pad" },
        { type: "settle-clip-edit" },
      ],
      base
    );
    expect(padsOf(state)[0]?.sound).toMatchObject({ decay: 0.01, tune: -48 });
    expect(state.history.past).toHaveLength(2);
  });

  test("DEV-013: a pad moved onto another swaps their notes", () => {
    const base = run([addDrums()]);
    const rack = drumsOf(base)?.id as string;
    const kick = drumsOf(base)?.rack?.chains[0]?.id as string;
    const swapped = run(
      [{ chain: kick, note: 42, rack, track: "beat", type: "move-pad" }],
      base
    );
    expect(padsOf(swapped).map((pad) => [pad.name, pad.note])).toEqual([
      ["Kick", 42],
      ["Snare", 38],
      ["Hat", 36],
    ]);
    const moved = run(
      [{ chain: kick, note: 50, rack, track: "beat", type: "move-pad" }],
      base
    );
    expect(padsOf(moved)[0]?.note).toBe(50);
  });
});
