import { describe, expect, test } from "bun:test";
import {
  apply,
  createArrangementState,
  trackOf,
} from "@/lib/arrangement-state";
import {
  addDeviceCommand,
  automatedParameter,
  hasOutput,
  takesDevice,
} from "@/lib/daw/devices";
import { NEW_TRACK } from "@/lib/daw/drop";
import { newProject, TRACK_COLOR_COUNT } from "@/lib/daw/project";

const SYNTH = "audioui.pocket-synth";
const DELAY = "audioui.delay";

/** The new project as a state the commands apply to. */
function project() {
  const doc = newProject();
  return createArrangementState({
    colors: TRACK_COLOR_COUNT,
    duration: doc.duration,
    initialClips: doc.clips,
    initialLoop: doc.loop,
    initialMain: doc.main,
    initialReturns: doc.returns,
    initialTracks: doc.tracks,
    tempo: doc.tempo,
  });
}

/** The state after adding `device` as the library does, and where it went. */
function added(device: string, onto: string | null, index?: number) {
  const state = project();
  const made = addDeviceCommand(state.doc, device, onto, index);
  if (!made) {
    throw new Error(`no command for ${device}`);
  }
  return { after: apply(state, made.command), made, state };
}

const devicesOf = (doc: ReturnType<typeof project>["doc"], track: string) =>
  trackOf(doc, track)?.devices?.map((device) => device.device) ?? [];

describe("adding a device from the library", () => {
  test("DEV-003: an effect goes at the end of the selected track's chain", () => {
    const { after, made } = added(DELAY, "track-1");
    expect(made.track).toBe("track-1");
    expect(devicesOf(after.doc, "track-1")).toEqual([DELAY]);
  });

  test("DEV-003: an effect goes on a return track and on the main track", () => {
    expect(devicesOf(added(DELAY, "return-1").after.doc, "return-1")).toEqual([
      "audioui.reverb",
      DELAY,
    ]);
    const main = project().doc.main.id;
    expect(devicesOf(added(DELAY, main).after.doc, main)).toEqual([DELAY]);
  });

  test("DEV-003: an instrument on a MIDI track takes the place of the one there", () => {
    const { after, made } = added("audioui.wave-shaper", "track-3");
    expect(made.track).toBe("track-3");
    expect(devicesOf(after.doc, "track-3")).toEqual(["audioui.wave-shaper"]);
  });

  test("DEV-003: dropped on a chain, it goes where it was dropped", () => {
    const { after } = added(DELAY, "track-3", 1);
    expect(devicesOf(after.doc, "track-3")).toEqual([SYNTH, DELAY]);
  });

  test("DEV-003: with no track selected, an instrument makes a MIDI track named after it, in one step of undo", () => {
    const { after, made, state } = added(SYNTH, null);
    const track = trackOf(after.doc, made.track);
    expect(track?.kind).toBe("midi");
    expect(track?.name).toBe("Pocket Synth");
    expect(after.doc.tracks.at(-1)?.id).toBe(made.track);
    expect(devicesOf(after.doc, made.track)).toEqual([SYNTH]);
    const undone = apply(after, { type: "undo" });
    expect(undone.doc.tracks).toEqual(state.doc.tracks);
  });

  test("DEV-003: with no track selected, an effect makes an audio track", () => {
    const { after, made } = added(DELAY, null);
    expect(trackOf(after.doc, made.track)?.kind).toBe("audio");
    expect(devicesOf(after.doc, made.track)).toEqual([DELAY]);
  });

  test("DEV-003: on the add-track button, a track of its own", () => {
    const { after, made } = added(DELAY, NEW_TRACK);
    expect(made.track).not.toBe(NEW_TRACK);
    expect(after.doc.tracks).toHaveLength(project().doc.tracks.length + 1);
    expect(devicesOf(after.doc, made.track)).toEqual([DELAY]);
  });

  test("DEV-002: an instrument picked with an audio track selected makes a MIDI track after it", () => {
    const { after, made } = added(SYNTH, "track-1");
    const ids = after.doc.tracks.map((track) => track.id);
    expect(ids.indexOf(made.track)).toBe(ids.indexOf("track-1") + 1);
    expect(trackOf(after.doc, made.track)?.kind).toBe("midi");
    expect(devicesOf(after.doc, "track-1")).toEqual([]);
  });

  test("DEV-002: which tracks take an instrument", () => {
    const { doc } = project();
    expect(takesDevice(doc, "track-3", true)).toBe(true);
    expect(takesDevice(doc, "track-1", true)).toBe(false);
    expect(takesDevice(doc, "return-1", true)).toBe(false);
    expect(takesDevice(doc, "return-1", false)).toBe(true);
    expect(takesDevice(doc, "nowhere", false)).toBe(false);
  });

  test("a device the library does not have adds nothing", () => {
    expect(
      addDeviceCommand(project().doc, "elsewhere.device", "track-1")
    ).toBeNull();
  });

  test("the commands are those of the arrangement", () => {
    const command = addDeviceCommand(project().doc, SYNTH, null)?.command;
    const types =
      command?.type === "batch"
        ? command.commands.map((each) => each.type)
        : [];
    expect(types).toEqual(["add-track", "add-device"]);
  });
});

describe("a track's output", () => {
  test("MIX-024: a MIDI track has one with an instrument, and none without", () => {
    const state = project();
    const midi = trackOf(state.doc, "track-3");
    const audio = trackOf(state.doc, "track-1");
    if (!(midi && audio)) {
      throw new Error("the new project lost a track");
    }
    expect(hasOutput(midi)).toBe(true);
    expect(hasOutput(audio)).toBe(true);
    expect(hasOutput({ ...midi, devices: [] })).toBe(false);
    expect(hasOutput({ ...midi, devices: undefined })).toBe(false);
  });

  test("MIX-024: its lane shows a device parameter, or nothing, never a volume it lacks", () => {
    const midi = trackOf(project().doc, "track-3");
    if (!midi) {
      throw new Error("the new project lost a track");
    }
    const bare = { ...midi, devices: [] };
    const key = "device:d:cutoff" as const;
    expect(automatedParameter(midi, "volume")).toBe("volume");
    expect(automatedParameter(bare, "volume", [{ key }])).toBe(key);
    expect(automatedParameter(bare, "pan", [{ key }])).toBe(key);
    expect(automatedParameter(bare, key, [{ key }])).toBe(key);
    expect(automatedParameter(bare, "volume")).toBeNull();
  });
});
