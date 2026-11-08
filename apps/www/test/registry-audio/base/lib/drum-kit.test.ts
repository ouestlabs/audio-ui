import { describe, expect, test } from "bun:test";
import { DRUM_RACK_DEVICE } from "@/registry-audio/bases/base/lib/arrangement";
import {
  type ArrangementCommand,
  apply,
  createArrangementState,
} from "@/registry-audio/bases/base/lib/arrangement-state";
import {
  DRUM_KIT_PADS,
  DRUM_NOTES,
  drumKit,
} from "@/registry-audio/bases/base/lib/drum-kit";
import { drumSynthDevice } from "@/registry-audio/bases/base/lib/drum-synth-device";

function setup() {
  return createArrangementState({
    colors: 5,
    duration: 10,
    initialTracks: [{ color: 0, id: "beat", kind: "midi", name: "Beat" }],
    tempo: { beatUnit: 4, beatsPerBar: 4, bpm: 120 },
  });
}

const run = (
  commands: ArrangementCommand[],
  from: ReturnType<typeof setup> = setup()
) => commands.reduce((state, command) => apply(state, command), from);

const addKit: ArrangementCommand = {
  device: DRUM_RACK_DEVICE,
  instrument: true,
  rack: drumKit(),
  state: {},
  track: "beat",
  type: "add-device",
};
const kitOf = (state: ReturnType<typeof setup>) =>
  state.doc.tracks[0]?.devices?.[0]?.rack;

describe("drumKit", () => {
  test("a pad per note, each a Drum Synth at the head of its chain", () => {
    const kit = drumKit();
    const notes = kit.chains.map((chain) => chain.pad?.note);
    expect(new Set(notes).size).toBe(DRUM_KIT_PADS.length);
    expect(notes).toContain(DRUM_NOTES.kick);
    for (const chain of kit.chains) {
      expect(chain.devices[0]).toMatchObject({
        device: drumSynthDevice.id,
        instrument: true,
      });
    }
  });

  test("the snare and the clap play in a room, and the hats choke each other", () => {
    const kit = drumKit();
    const pad = (note: number) =>
      kit.chains.find((chain) => chain.pad?.note === note);
    expect(pad(DRUM_NOTES.snare)?.devices[1]?.device).toBe("audioui.reverb");
    expect(pad(DRUM_NOTES.clap)?.devices[1]?.device).toBe("audioui.reverb");
    expect(pad(DRUM_NOTES.kick)?.devices).toHaveLength(1);
    expect(pad(DRUM_NOTES.hat)?.pad?.choke).toBe(1);
    expect(pad(DRUM_NOTES.openHat)?.pad?.choke).toBe(1);
  });
});

describe("a drum rack started from a kit", () => {
  test("takes the kit, its chains and devices under ids no other has", () => {
    const once = run([addKit]);
    const twice = run([addKit], once);
    const first = kitOf(once);
    expect(first?.chains).toHaveLength(DRUM_KIT_PADS.length);
    const ids = (state: ReturnType<typeof setup>) =>
      (kitOf(state)?.chains ?? []).flatMap((chain) => [
        chain.id,
        ...chain.devices.map((device) => device.id),
      ]);
    // The second kit takes the first one's place, as an instrument does, under ids of its own.
    expect(new Set(ids(twice)).size).toBe(ids(twice).length);
    expect(ids(twice)).not.toEqual(ids(once));
  });

  test("a pad joins a choke group and leaves it, and a sound put on it keeps its group", () => {
    const state = run([addKit]);
    const rack = state.doc.tracks[0]?.devices?.[0];
    const kick = rack?.rack?.chains[0];
    const grouped = run(
      [
        {
          chain: kick?.id as string,
          choke: 2,
          rack: rack?.id as string,
          track: "beat",
          type: "set-pad-choke",
        },
        {
          note: DRUM_NOTES.kick,
          rack: rack?.id as string,
          sound: { decay: 0.2, kind: "synth", tune: 0, voice: "kick" },
          track: "beat",
          type: "set-pad",
        },
      ],
      state
    );
    expect(kitOf(grouped)?.chains[0]?.pad?.choke).toBe(2);
    const out = run(
      [
        {
          chain: kick?.id as string,
          choke: null,
          rack: rack?.id as string,
          track: "beat",
          type: "set-pad-choke",
        },
      ],
      grouped
    );
    expect(kitOf(out)?.chains[0]?.pad).not.toHaveProperty("choke");
  });

  test("a pad takes an instrument at its head, as its sound", () => {
    const state = run([
      {
        device: DRUM_RACK_DEVICE,
        instrument: true,
        state: {},
        track: "beat",
        type: "add-device",
      },
    ]);
    const rack = state.doc.tracks[0]?.devices?.[0];
    const pad = rack?.rack?.chains[0];
    const next = run(
      [
        {
          chain: { chain: pad?.id as string, rack: rack?.id as string },
          device: drumSynthDevice.id,
          instrument: true,
          state: drumSynthDevice.defaults(),
          track: "beat",
          type: "add-device",
        },
      ],
      state
    );
    expect(kitOf(next)?.chains[0]?.devices[0]?.device).toBe(drumSynthDevice.id);
  });
});
