import { describe, expect, test } from "bun:test";
import {
  type ArrangementTrack,
  DRUM_RACK_DEVICE,
  type DrumSound,
  INSTRUMENT_RACK_DEVICE,
  inZone,
  padRecordings,
  renamePadRecordings,
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

describe("drum rack recordings", () => {
  test("DEV-013: a project lists the recordings its pads play, and renames them", () => {
    const base = run([addDrums()]);
    const rack = drumsOf(base)?.id as string;
    const state = run(
      [
        {
          name: "Clap",
          note: 39,
          rack,
          sound: clap,
          track: "beat",
          type: "set-pad",
        },
      ],
      base
    );
    expect([...padRecordings(state.doc.tracks)]).toEqual(["clap"]);
    const renamed = renamePadRecordings(
      state.doc.tracks[0] as ArrangementTrack,
      (id) => `${id}-2`
    );
    expect([...padRecordings([renamed])]).toEqual(["clap-2"]);
    const untouched = state.doc.tracks[1] as ArrangementTrack;
    expect(renamePadRecordings(untouched, (id) => `${id}-2`)).toBe(untouched);
  });
});

describe("instrument racks", () => {
  const addLayers: ArrangementCommand = {
    device: INSTRUMENT_RACK_DEVICE,
    instrument: true,
    state: {},
    track: "beat",
    type: "add-device",
  };
  const layersOf = (state: State) =>
    state.doc.tracks[0]?.devices?.find(
      (device) => device.device === INSTRUMENT_RACK_DEVICE
    );

  test("DEV-014: an instrument rack goes first on a MIDI track, with one empty chain, and a chain takes an instrument at its head", () => {
    const base = run([addLayers]);
    const rack = layersOf(base);
    expect(rack?.instrument).toBe(true);
    expect(rack?.rack?.chains).toHaveLength(1);
    const chain = rack?.rack?.chains[0]?.id as string;
    const place = { chain, rack: rack?.id as string };
    const state = run(
      [
        {
          chain: place,
          device: "audioui.reverb",
          state: {},
          track: "beat",
          type: "add-device",
        },
        {
          chain: place,
          device: "audioui.pocket-synth",
          instrument: true,
          state: {},
          track: "beat",
          type: "add-device",
        },
      ],
      base
    );
    expect(
      layersOf(state)?.rack?.chains[0]?.devices.map((device) => [
        device.device,
        Boolean(device.instrument),
      ])
    ).toEqual([
      ["audioui.pocket-synth", true],
      ["audioui.reverb", false],
    ]);
  });

  test("DEV-014: an effect rack's chain takes no instrument, nor does a chain take a rack as its instrument", () => {
    const fx = run([
      { device: "audioui.rack", state: {}, track: "beat", type: "add-device" },
    ]);
    const effects = fx.doc.tracks[0]?.devices?.[0];
    const intoEffects = run(
      [
        {
          chain: {
            chain: effects?.rack?.chains[0]?.id as string,
            rack: effects?.id as string,
          },
          device: "audioui.pocket-synth",
          instrument: true,
          state: {},
          track: "beat",
          type: "add-device",
        },
      ],
      fx
    );
    expect(intoEffects).toBe(fx);
    const base = run([addLayers]);
    const rack = layersOf(base);
    const nested = run(
      [
        {
          chain: {
            chain: rack?.rack?.chains[0]?.id as string,
            rack: rack?.id as string,
          },
          device: DRUM_RACK_DEVICE,
          instrument: true,
          state: {},
          track: "beat",
          type: "add-device",
        },
      ],
      base
    );
    expect(nested).toBe(base);
  });
});

describe("instrument rack zones", () => {
  test("DEV-015: a chain's zone keeps whole keys from 0 to 127 and velocities from 0 to 1, its ends in order, as one step of a drag", () => {
    const base = run([
      {
        device: INSTRUMENT_RACK_DEVICE,
        instrument: true,
        state: {},
        track: "beat",
        type: "add-device",
      },
    ]);
    const rack = base.doc.tracks[0]?.devices?.[0];
    const chain = rack?.rack?.chains[0]?.id as string;
    const state = run(
      [
        {
          chain,
          rack: rack?.id as string,
          track: "beat",
          type: "change-rack-chain",
          zone: { keys: [72.4, 36] },
        },
        {
          chain,
          rack: rack?.id as string,
          track: "beat",
          type: "change-rack-chain",
          zone: { velocity: [-1, 0.5] },
        },
        { type: "settle-clip-edit" },
      ],
      base
    );
    expect(state.doc.tracks[0]?.devices?.[0]?.rack?.chains[0]?.zone).toEqual({
      keys: [36, 72],
      velocity: [0, 0.5],
    });
    expect(state.history.past).toHaveLength(2);
  });

  test("DEV-015: a note is in a zone when its pitch and its velocity both are, ends in; a chain with no zone plays them all", () => {
    const zone = { keys: [36, 59] as const, velocity: [0, 0.5] as const };
    expect(inZone(zone, 36, 0.5)).toBe(true);
    expect(inZone(zone, 60, 0.5)).toBe(false);
    expect(inZone(zone, 40, 0.6)).toBe(false);
    expect(inZone(undefined, 127, 1)).toBe(true);
  });
});
