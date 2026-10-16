import { describe, expect, mock, test } from "bun:test";
import {
  DeviceDefinitionError,
  defineDevice,
  deviceTools,
  NOTE_DURATION,
  playNote,
} from "./index.ts";

const synth = defineDevice({
  description: "A voice.",
  id: "audioui.test-voice",
  kind: "instrument",
  name: "Voice",
  note: [
    {
      default: 220,
      id: "frequency",
      label: "Pitch",
      max: 1000,
      min: 20,
      scale: "log",
      unit: "Hz",
    },
    { default: 1000, id: "cutoff", label: "Cutoff", max: 8000, min: 200 },
  ],
  parameters: [{ default: 0.5, id: "volume", label: "Volume", max: 1, min: 0 }],
});

const [, , play] = deviceTools(synth);
const state = synth.defaults();

describe("an instrument's note", () => {
  test("an instrument with a note has a third tool, play, and an effect has two", () => {
    expect(deviceTools(synth).map((tool) => tool.name)).toEqual([
      "audioui_test_voice_set",
      "audioui_test_voice_reset",
      "audioui_test_voice_play",
    ]);
    const effect = defineDevice({
      description: "x",
      id: "audioui.test-effect",
      name: "Effect",
      parameters: [{ default: 1, id: "a", label: "A", max: 2, min: 0 }],
    });
    expect(deviceTools(effect)).toHaveLength(2);
    expect(effect.note).toEqual([]);
  });

  test("the schema tells a model every part of the note, and the duration", () => {
    const { properties } = play?.inputSchema ?? {};
    expect(Object.keys(properties ?? {})).toEqual([
      "frequency",
      "cutoff",
      "duration",
    ]);
    expect(properties?.frequency?.minimum).toBe(20);
    expect(properties?.duration?.maximum).toBe(NOTE_DURATION.max);
  });

  test("a call gives the note to play and how long, and leaves the state alone", () => {
    const result = play?.run(state, { duration: 2, frequency: 440 });
    expect(result?.note).toEqual({ cutoff: 1000, frequency: 440 });
    expect(result?.duration).toBe(2);
    expect(result?.state).toBe(state);
    expect(result?.summary).toBe("Playing for 2 s: Pitch: 440 Hz");
  });

  test("a part left out takes its default, and an empty call still plays", () => {
    const result = play?.run(state, {});
    expect(result?.note).toEqual({ cutoff: 1000, frequency: 220 });
    expect(result?.duration).toBe(NOTE_DURATION.default);
    expect(play?.run(state, "hum")?.note).toEqual({
      cutoff: 1000,
      frequency: 220,
    });
  });

  test("a value out of range is brought in and marked, a wrong one refused by name", () => {
    const result = play?.run(state, {
      cutoff: "bright",
      duration: 500,
      frequency: 5000,
      volume: 1,
    });
    expect(result?.note?.frequency).toBe(1000);
    expect(result?.duration).toBe(NOTE_DURATION.max);
    expect(result?.summary).toContain("Pitch: 1000 Hz (brought into range)");
    expect(result?.summary).toContain("cutoff: refused, not a number");
    expect(result?.summary).toContain("duration: 30 s (brought into range)");
    expect(result?.summary).toContain("volume: refused, unknown parameter");
  });

  test("a duration that is not a number is refused and the default holds", () => {
    const result = play?.run(state, { duration: "long" });
    expect(result?.duration).toBe(NOTE_DURATION.default);
    expect(result?.summary).toContain("duration: refused, not a number");
  });

  test("describe lists the note", () => {
    expect(synth.describe().note?.map((part) => part.id)).toEqual([
      "frequency",
      "cutoff",
    ]);
    expect(synth.describe().note?.[0]?.scale).toBe("log");
  });

  test("an effect cannot have a note, and `duration` is not a name for a part", () => {
    expect(() =>
      defineDevice({
        description: "x",
        id: "audioui.bad",
        name: "Bad",
        note: [{ default: 1, id: "pitch", label: "P", max: 2, min: 0 }],
        parameters: [{ default: 1, id: "a", label: "A", max: 2, min: 0 }],
      })
    ).toThrow("only an instrument has notes");
    expect(() =>
      defineDevice({
        description: "x",
        id: "audioui.bad",
        kind: "instrument",
        name: "Bad",
        note: [{ default: 1, id: "duration", label: "D", max: 2, min: 0 }],
        parameters: [{ default: 1, id: "a", label: "A", max: 2, min: 0 }],
      })
    ).toThrow(DeviceDefinitionError);
    expect(() =>
      defineDevice({
        description: "x",
        id: "audioui.bad",
        kind: "instrument",
        name: "Bad",
        note: [
          { default: 1, id: "p", label: "P", max: 2, min: 0 },
          { default: 1, id: "p", label: "Q", max: 2, min: 0 },
        ],
        parameters: [{ default: 1, id: "a", label: "A", max: 2, min: 0 }],
      })
    ).toThrow("two parts of a note have this id");
  });
});

describe("playNote", () => {
  test("starts the note now and lets it go when the time is up", async () => {
    const instrument = {
      noteOff: mock(() => undefined),
      noteOn: mock((_note: unknown) => undefined),
    };
    playNote(instrument, { frequency: 440 }, 0.02);
    expect(instrument.noteOn).toHaveBeenCalledWith({ frequency: 440 });
    expect(instrument.noteOff).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(instrument.noteOff).toHaveBeenCalledTimes(1);
  });

  test("lets it go early when cancelled, once", async () => {
    const instrument = {
      noteOff: mock(() => undefined),
      noteOn: mock((_note: unknown) => undefined),
    };
    const cancel = playNote(instrument, { frequency: 440 }, 0.02);
    cancel();
    cancel();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(instrument.noteOff).toHaveBeenCalledTimes(1);
  });
});

describe("latency and context", () => {
  const delayed = defineDevice({
    description: "A device that looks ahead.",
    id: "audioui.test-latency",
    latency: (current, sampleRate) =>
      0.006 + (current.deep ? 192 / sampleRate : 0),
    name: "Look-ahead",
    parameters: [{ default: false, id: "deep", kind: "toggle", label: "Deep" }],
  });

  test("a device that declares a latency reports it for a state and a sample rate", () => {
    expect(delayed.latency({ deep: false }, 48_000)).toBeCloseTo(0.006, 9);
    expect(delayed.latency({ deep: true }, 48_000)).toBeCloseTo(0.01, 9);
    expect(delayed.latency({ deep: true }, 96_000)).toBeCloseTo(0.008, 9);
  });

  test("a device that does not declare one adds none, and a negative one is none", () => {
    expect(synth.latency(synth.defaults(), 48_000)).toBe(0);
    const odd = defineDevice({
      description: "x",
      id: "audioui.odd",
      latency: () => -1,
      name: "Odd",
      parameters: [{ default: 1, id: "a", label: "A", max: 2, min: 0 }],
    });
    expect(odd.latency(odd.defaults(), 48_000)).toBe(0);
  });
});

describe("a device that takes a key signal", () => {
  const gate = defineDevice({
    description: "Opens on a key.",
    id: "audioui.test-gate",
    name: "Gate",
    parameters: [
      { default: -30, id: "threshold", label: "Threshold", max: 0, min: -60 },
    ],
    sidechain: true,
  });

  test("says so, and an ordinary device does not", () => {
    expect(gate.sidechain).toBe(true);
    expect(gate.describe().sidechain).toBe(true);
    expect(synth.sidechain).toBe(false);
    expect(synth.describe().sidechain).toBeUndefined();
  });

  test("it is not a parameter: the key is a signal, so the state and the tools do not carry it", () => {
    expect(Object.keys(gate.defaults())).toEqual(["threshold"]);
    expect(gate.describe().parameters.map((part) => part.id)).toEqual([
      "threshold",
    ]);
    expect(deviceTools(gate)).toHaveLength(2);
  });
});
