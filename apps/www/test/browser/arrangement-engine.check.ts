import type { ParameterValue } from "@audio-ui/core/device";
import {
  type Arranged,
  type ArrangementTrack,
  DRUM_RACK_DEVICE,
  type DrumSound,
  type TrackDevice,
} from "@/registry-audio/bases/base/lib/arrangement";
import {
  createArrangementEngine,
  type MetronomeSettings,
  renderArrangement,
} from "@/registry-audio/bases/base/lib/arrangement-engine";
import {
  type ArrangementDoc,
  createArrangementState,
} from "@/registry-audio/bases/base/lib/arrangement-state";
import { libraryDevice } from "@/registry-audio/bases/base/lib/device-library";
import { assert, check, firstDifference } from "./harness.ts";

const RATE = 48_000;

/** A recording whose every sample differs: in both channels, or the same in both. */
function recording(seconds: number, same = false) {
  const length = Math.round(seconds * RATE);
  const channel = (offset: number) =>
    Float32Array.from(
      { length },
      (_, index) =>
        0.4 * Math.sin(index * 0.011 + offset) * Math.cos(index * 3e-5)
    );
  return {
    channels: same ? [channel(0), channel(0)] : [channel(0), channel(1)],
    sampleRate: RATE,
  };
}

/** An impulse at a frame: what lines paths up. */
function impulse(seconds: number, at: number) {
  const data = new Float32Array(Math.round(seconds * RATE));
  data[at] = 0.5;
  return { channels: [data, data], sampleRate: RATE };
}

const clip = (
  id: string,
  track: string,
  start: number,
  length: number,
  rec = "take"
): Arranged => ({
  id,
  name: id,
  recording: rec,
  sourceLength: length,
  track,
  value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start },
});

function arrangement({
  clips = [],
  returns = [],
  tracks,
}: {
  clips?: Arranged[];
  returns?: ArrangementTrack[];
  tracks: ArrangementTrack[];
}): ArrangementDoc {
  return createArrangementState({
    colors: 5,
    duration: 10,
    initialClips: clips,
    initialReturns: returns,
    initialTracks: tracks,
    tempo: { beatUnit: 4, beatsPerBar: 4, bpm: 120 },
  }).doc;
}

function device(
  id: string,
  deviceId: string,
  patch: Record<string, ParameterValue> = {}
): TrackDevice {
  const entry = libraryDevice(deviceId);
  assert(entry, `the library has ${deviceId}`);
  return {
    device: deviceId,
    id,
    ...(entry.device.kind === "instrument" ? { instrument: true } : {}),
    state: { ...entry.device.defaults(), ...patch },
  };
}

const render = async (
  doc: ArrangementDoc,
  recordings: Map<string, unknown>,
  to: number
) => {
  const buffer = await renderArrangement(doc, recordings as never, {
    sampleRate: RATE,
    to,
  });
  assert(buffer, "the browser renders the arrangement offline");
  return buffer;
};

check(
  "EXP-007: a neutral clip through a track at unity and the main track comes out bit-identical",
  async () => {
    const take = recording(0.5);
    const doc = arrangement({
      clips: [clip("a", "vox", 0.1, 0.5)],
      tracks: [{ color: 0, id: "vox", name: "Vox" }],
    });
    const out = await render(doc, new Map([["take", take]]), 0.7);
    for (let channel = 0; channel < 2; channel += 1) {
      const at = firstDifference(
        out.getChannelData(channel).subarray(0.1 * RATE, 0.6 * RATE),
        take.channels[channel] as Float32Array
      );
      assert(at === -1, `channel ${channel} differs at frame ${at}`);
    }
  }
);

check(
  "MIX-003: panned hard left, the left channel is 3 dB up and the right one silent",
  async () => {
    const take = recording(0.2, true);
    const doc = arrangement({
      clips: [clip("a", "vox", 0, 0.2)],
      tracks: [
        {
          color: 0,
          id: "vox",
          mix: { color: 0, gain: 1, muted: false, pan: -1, soloed: false },
          name: "Vox",
        },
      ],
    });
    const out = await render(doc, new Map([["take", take]]), 0.25);
    const left = out.getChannelData(0);
    const right = out.getChannelData(1);
    const source = take.channels[0] as Float32Array;
    // Past the 10 ms the pan takes to settle from the centre.
    for (const index of [2400, 5000, 9000]) {
      assert(
        Math.abs(
          (left[index] as number) - (source[index] as number) * Math.SQRT2
        ) < 1e-5,
        `left is not +3 dB at ${index}`
      );
      assert(
        Math.abs(right[index] as number) < 1e-6,
        `right is not silent at ${index}`
      );
    }
  }
);

check(
  "MIX-004: a track switched off still feeds a pre-fader return, and no post-fader one",
  async () => {
    const take = recording(0.2, true);
    const off = { color: 0, gain: 1, muted: true, pan: 0, soloed: false };
    const withMode = async (pre: boolean) => {
      const doc = arrangement({
        clips: [clip("a", "vox", 0, 0.2)],
        returns: [{ color: 0, id: "hall", name: "A Return", pre }],
        tracks: [
          { color: 0, id: "vox", mix: off, name: "Vox", sends: { hall: 1 } },
        ],
      });
      const out = await render(doc, new Map([["take", take]]), 0.25);
      return Math.max(
        ...out.getChannelData(0).subarray(2400, 9000).map(Math.abs)
      );
    };
    assert(
      (await withMode(true)) > 0.1,
      "a pre-fader send of a track switched off is silent"
    );
    assert(
      (await withMode(false)) < 1e-4,
      "a post-fader send of a track switched off is heard"
    );
  }
);

check(
  "MIX-012: a track delayed by its devices and one that is not reach the main track on the same frame",
  async () => {
    const at = 1000;
    const doc = arrangement({
      clips: [
        clip("a", "slow", 0, 0.5, "click"),
        clip("b", "fast", 0, 0.5, "click"),
      ],
      tracks: [
        // A compressor that looks ahead, set so it leaves an impulse alone.
        {
          color: 0,
          devices: [device("d1", "audioui.compressor", { threshold: 0 })],
          id: "slow",
          name: "Slow",
        },
        { color: 1, id: "fast", name: "Fast" },
      ],
    });
    const recordings = new Map([["click", impulse(0.5, at)]]);
    const peakOf = async (soloed: string) => {
      const solo = {
        ...doc,
        tracks: doc.tracks.map((track) => ({
          ...track,
          mix: {
            color: 0,
            gain: 1,
            muted: false,
            pan: 0,
            soloed: track.id === soloed,
          },
        })),
      };
      const data = (await render(solo, recordings, 0.5)).getChannelData(0);
      let loudest = 0;
      for (let index = 1; index < data.length; index += 1) {
        if (
          Math.abs(data[index] as number) > Math.abs(data[loudest] as number)
        ) {
          loudest = index;
        }
      }
      return loudest;
    };
    const slow = await peakOf("slow");
    const fast = await peakOf("fast");
    assert(
      slow === fast,
      `the delayed track peaks at frame ${slow}, the other at ${fast}`
    );
    assert(
      fast > at,
      `the undelayed track waits for the delayed one (peak at ${fast})`
    );
  }
);

check(
  "MID-001: a note of a MIDI clip plays through the track's instrument, on its frame",
  async () => {
    const doc = arrangement({
      clips: [
        {
          ...clip("m", "keys", 0, 1),
          notes: [{ id: "n", length: 0.2, pitch: 69, start: 0.1, velocity: 1 }],
          recording: undefined,
        },
      ],
      tracks: [
        {
          color: 0,
          devices: [device("s", "audioui.pocket-synth", { wave: "sine" })],
          id: "keys",
          kind: "midi",
          name: "Keys",
        },
      ],
    });
    const out = (await render(doc, new Map(), 0.5)).getChannelData(0);
    const before = Math.max(...out.subarray(0, 4800).map(Math.abs));
    const during = Math.max(...out.subarray(5000, 14_000).map(Math.abs));
    const after = Math.max(...out.subarray(20_000, 24_000).map(Math.abs));
    assert(before === 0, `sound before the note (${before})`);
    assert(during > 0.05, `the note is near silent (${during})`);
    assert(after < 1e-4, `the note rings past its release (${after})`);
  }
);

check("MID-001: a chord plays all its notes, one voice each", async () => {
  const pitches = [57, 60, 64];
  const doc = arrangement({
    clips: [
      {
        ...clip("m", "keys", 0, 1),
        notes: pitches.map((pitch, index) => ({
          id: `n${index}`,
          length: 0.4,
          pitch,
          start: 0,
          velocity: 1,
        })),
        recording: undefined,
      },
    ],
    tracks: [
      {
        color: 0,
        devices: [device("s", "audioui.pocket-synth", { wave: "sine" })],
        id: "keys",
        kind: "midi",
        name: "Keys",
      },
    ],
  });
  const out = (await render(doc, new Map(), 0.4))
    .getChannelData(0)
    .subarray(2400, 16_800);
  // How much of each pitch's fundamental the render holds (Goertzel).
  const energy = (pitch: number) => {
    const frequency = 440 * 2 ** ((pitch - 69) / 12);
    const k = (2 * Math.PI * frequency) / RATE;
    let s1 = 0;
    let s2 = 0;
    for (const sample of out) {
      const s0 = sample + 2 * Math.cos(k) * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return (
      Math.sqrt(s1 * s1 + s2 * s2 - 2 * Math.cos(k) * s1 * s2) / out.length
    );
  };
  const levels = pitches.map(energy);
  const missing = 58;
  assert(
    levels.every((level) => level > 10 * energy(missing)),
    `not every note of the chord sounds: ${levels.map((level) => level.toFixed(4)).join(", ")} against ${energy(missing).toFixed(4)}`
  );
});

check(
  "a note played by hand sounds through the track's instrument and chain",
  async () => {
    const ctx = new OfflineAudioContext(2, RATE / 2, RATE);
    const engine = await createArrangementEngine(ctx);
    assert(engine, "the engine loads");
    engine.update(
      arrangement({
        tracks: [
          {
            color: 0,
            devices: [device("s", "audioui.pocket-synth", { wave: "sine" })],
            id: "keys",
            kind: "midi",
            name: "Keys",
          },
        ],
      }),
      new Map()
    );
    await engine.ready();
    engine.noteOn("keys", 69, 1);
    const out = (await ctx.startRendering()).getChannelData(0);
    const loudest = Math.max(...out.subarray(2400, 12_000).map(Math.abs));
    engine.dispose();
    assert(loudest > 0.05, `the note is near silent (${loudest})`);
  }
);

/** What the metronome alone plays of `doc` from `from`, for `seconds`. */
async function clicked(
  doc: ArrangementDoc,
  seconds: number,
  settings: MetronomeSettings = { on: true }
) {
  const frames = seconds * RATE;
  const ctx = new OfflineAudioContext(2, frames, RATE);
  const engine = await createArrangementEngine(ctx);
  assert(engine, "the browser runs the engine offline");
  engine.update(doc, new Map());
  await engine.ready();
  engine.setMetronome(settings);
  engine.play(0, 0);
  engine.schedule(0, frames);
  const buffer = await ctx.startRendering();
  const { latency } = engine;
  engine.dispose();
  return { data: buffer.getChannelData(0), latency };
}

/** The frames where a click begins out of silence. */
function onsets(data: Float32Array) {
  const found: number[] = [];
  let quiet = true;
  let silent = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (Math.abs(data[index] ?? 0) > 0.002) {
      if (quiet) {
        found.push(index);
      }
      quiet = false;
      silent = 0;
    } else {
      silent += 1;
      if (silent > 1000) {
        quiet = true;
      }
    }
  }
  return found;
}

/** How high a click rings: a click on a bar's first beat is the higher one. */
function pitchAt(data: Float32Array, onset: number) {
  const span = Math.round(0.03 * RATE);
  let crossings = 0;
  for (let index = onset + 1; index < onset + span; index += 1) {
    if ((data[index - 1] ?? 0) < 0 !== (data[index] ?? 0) < 0) {
      crossings += 1;
    }
  }
  return crossings / 2 / 0.03;
}

const QUARTER = RATE / 2;
/** How far a found onset may sit from its frame: the click's first millisecond rises under the threshold. */
const ONSET_TOLERANCE = 96;

const onTheBeats = (found: number[], beat: number, offset = 0) =>
  found.every(
    (frame, index) => Math.abs(frame - offset - index * beat) <= ONSET_TOLERANCE
  );

check(
  "TRN-016: the metronome clicks on each beat, the first of a bar higher",
  async () => {
    const { data } = await clicked(
      arrangement({ tracks: [{ color: 0, id: "a", name: "A" }] }),
      4.2
    );
    const found = onsets(data);
    assert(
      found.length === 9,
      `${found.length} clicks in 4.2 seconds at 120 BPM`
    );
    assert(onTheBeats(found, QUARTER), `clicks at ${found.join(", ")}`);
    found.forEach((frame, index) => {
      const pitch = pitchAt(data, frame);
      const expected = index % 4 === 0 ? 1500 : 1000;
      assert(
        Math.abs(pitch - expected) < 100,
        `click ${index} rings at ${pitch} Hz, not ${expected}`
      );
    });
  }
);

check("TRN-016: the clicks follow the loop and the rhythm", async () => {
  const doc = arrangement({ tracks: [{ color: 0, id: "a", name: "A" }] });
  const looped = await clicked(
    { ...doc, loop: { on: true, range: [0, 1] } },
    2.2
  );
  const found = onsets(looped.data);
  assert(
    found.length === 5,
    `${found.length} clicks over two passes of a loop`
  );
  assert(onTheBeats(found, QUARTER), `clicks at ${found.join(", ")}`);
  assert(
    pitchAt(looped.data, found[2] ?? 0) > 1400,
    "a new pass of the loop does not click its first beat high"
  );
  const bars = await clicked(doc, 4.2, { on: true, rhythm: "1-bar" });
  assert(
    onTheBeats(onsets(bars.data), RATE * 2),
    `a click a bar landed at ${onsets(bars.data).join(", ")}`
  );
});

check(
  "TRN-016: the clicks wait for the delay compensation of what they count",
  async () => {
    const { data, latency } = await clicked(
      arrangement({
        tracks: [
          {
            color: 0,
            // A compressor that looks ahead.
            devices: [device("late", "audioui.compressor")],
            id: "a",
            name: "A",
          },
        ],
      }),
      1.2
    );
    assert(latency > 0, "the chain delays the sound");
    assert(
      onTheBeats(onsets(data), QUARTER, latency),
      `clicks at ${onsets(data).join(", ")} with ${latency} frames of latency`
    );
  }
);

check(
  "TRN-016: the metronome stays out of an export, and off is silent",
  async () => {
    const doc = arrangement({ tracks: [{ color: 0, id: "a", name: "A" }] });
    const rendered = await render(doc, new Map(), 1.2);
    assert(
      rendered.getChannelData(0).every((sample) => sample === 0),
      "an export of an empty arrangement holds a click"
    );
    const { data } = await clicked(doc, 1.2, { on: false });
    assert(
      data.every((sample) => sample === 0),
      "the metronome clicks while it is off"
    );
  }
);

/** The frame of the loudest sample, and its level, of a render's left channel. */
function loudestOf(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0);
  let at = 0;
  for (let index = 1; index < data.length; index += 1) {
    if (Math.abs(data[index] as number) > Math.abs(data[at] as number)) {
      at = index;
    }
  }
  return { at, level: Math.abs(data[at] as number) };
}

const unity = (gain: number, soloed = false) => ({
  color: 0,
  gain,
  muted: false,
  pan: 0,
  soloed,
});

check(
  "MIX-020: a track in a group plays through the group's channel",
  async () => {
    // Past the few milliseconds a fader takes to settle where it is set.
    const at = 9600;
    const doc = arrangement({
      clips: [clip("a", "kick", 0, 0.5, "click")],
      tracks: [
        {
          color: 0,
          id: "drums",
          kind: "group",
          mix: unity(0.5),
          name: "Drums",
        },
        { color: 1, group: "drums", id: "kick", mix: unity(1), name: "Kick" },
      ],
    });
    const recordings = new Map([["click", impulse(0.5, at)]]);
    const half = loudestOf(await render(doc, recordings, 0.5));
    assert(
      Math.abs(half.level - 0.25) < 1e-4,
      `the kick through a group at half comes out at ${half.level}, not 0.25`
    );
    const silent = loudestOf(
      await render(
        {
          ...doc,
          tracks: doc.tracks.map((track) =>
            track.id === "drums" ? { ...track, mix: unity(0) } : track
          ),
        },
        recordings,
        0.5
      )
    );
    assert(
      silent.level < 1e-6,
      `the group's fader down leaves ${silent.level}`
    );
  }
);

check(
  "MIX-021: a track behind a group that delays and a track outside it reach the main track on the same frame",
  async () => {
    const at = 1000;
    const doc = arrangement({
      clips: [
        clip("a", "kick", 0, 0.5, "click"),
        clip("b", "bass", 0, 0.5, "click"),
      ],
      tracks: [
        {
          color: 0,
          // A compressor that looks ahead, set so it leaves an impulse alone.
          devices: [device("d1", "audioui.compressor", { threshold: 0 })],
          id: "drums",
          kind: "group",
          name: "Drums",
        },
        { color: 1, group: "drums", id: "kick", name: "Kick" },
        { color: 2, id: "bass", name: "Bass" },
      ],
    });
    const recordings = new Map([["click", impulse(0.5, at)]]);
    const soloed = (id: string) => ({
      ...doc,
      tracks: doc.tracks.map((track) => ({
        ...track,
        mix: unity(1, track.id === id),
      })),
    });
    const grouped = loudestOf(await render(soloed("kick"), recordings, 0.5));
    const alone = loudestOf(await render(soloed("bass"), recordings, 0.5));
    assert(
      grouped.at === alone.at,
      `the grouped track peaks at frame ${grouped.at}, the other at ${alone.at}`
    );
    assert(
      alone.at > at,
      `the track outside waits for the group (peak at ${alone.at})`
    );
  }
);

/** A rack of `chains` on a track, as a track device. */
function rackDevice(
  chains: {
    devices?: ReturnType<typeof device>[];
    id: string;
    mix?: { gain: number; muted: boolean; pan: number; soloed: boolean };
  }[],
  macros: {
    mappings: { device: string; max: number; min: number; parameter: string }[];
    value: number;
  }[] = []
) {
  return {
    device: "audioui.rack",
    id: "rack",
    rack: {
      chains: chains.map((chain) => ({
        devices: chain.devices ?? [],
        id: chain.id,
        name: chain.id,
        ...(chain.mix ? { mix: chain.mix } : {}),
      })),
      macros,
    },
    state: {},
  };
}

/** The loudest a rack on one track makes an impulse of 0.5, and where. */
async function throughRack(rack: ReturnType<typeof rackDevice>) {
  const at = 9600;
  const doc = arrangement({
    clips: [clip("a", "fx", 0, 0.5, "click")],
    tracks: [{ color: 0, devices: [rack], id: "fx", name: "Fx" }],
  });
  return loudestOf(
    await render(doc, new Map([["click", impulse(0.5, at)]]), 0.5)
  );
}

const chainMix = (gain: number, muted = false, soloed = false) => ({
  gain,
  muted,
  pan: 0,
  soloed,
});

check("DEV-010: a rack's chains play side by side and are summed", async () => {
  const both = await throughRack(rackDevice([{ id: "a" }, { id: "b" }]));
  assert(
    Math.abs(both.level - 1) < 1e-4,
    `two chains of an impulse of 0.5 sum to ${both.level}, not 1`
  );
});

check("DEV-010: a chain's volume, switch and solo, as a track's", async () => {
  const quieter = await throughRack(
    rackDevice([{ id: "a" }, { id: "b", mix: chainMix(0.5) }])
  );
  assert(
    Math.abs(quieter.level - 0.75) < 1e-4,
    `at half, the sum is ${quieter.level}`
  );
  const off = await throughRack(
    rackDevice([{ id: "a" }, { id: "b", mix: chainMix(1, true) }])
  );
  assert(
    Math.abs(off.level - 0.5) < 1e-4,
    `a chain switched off leaves ${off.level}`
  );
  const solo = await throughRack(
    rackDevice([{ id: "a" }, { id: "b", mix: chainMix(0.5, false, true) }])
  );
  assert(
    Math.abs(solo.level - 0.25) < 1e-4,
    `the soloed chain alone gives ${solo.level}`
  );
});

check(
  "DEV-011: chains that delay differently meet on the same frame, and the track waits for the rack",
  async () => {
    // A compressor that looks ahead, at unity: an impulse under its threshold, no make-up.
    const compressor = device("c", "audioui.compressor", {
      autoMakeup: false,
      makeupDb: 0,
      thresholdDb: 0,
    });
    const rack = rackDevice([
      { devices: [compressor], id: "slow" },
      { id: "fast" },
    ]);
    const aligned = await throughRack(rack);
    assert(
      Math.abs(aligned.level - 1) < 1e-3,
      `the two chains peak apart: the loudest sample is ${aligned.level}, not their sum`
    );
    assert(
      aligned.at > 9600,
      `the rack delays nothing (peak at ${aligned.at})`
    );
  }
);

check(
  "DEV-012: a macro turns the parameter mapped to it, over the stretch of its travel",
  async () => {
    const utility = device("u", "audioui.utility");
    const mapped = (value: number) =>
      rackDevice(
        [{ devices: [utility], id: "a" }],
        [
          {
            // From 0 dB to +6 dB of a gain that runs from -35 to +35 dB.
            mappings: [
              {
                device: "u",
                max: 0.5 + (20 * Math.log10(2)) / 70,
                min: 0.5,
                parameter: "gainDb",
              },
            ],
            value,
          },
        ]
      );
    const down = await throughRack(mapped(0));
    const up = await throughRack(mapped(1));
    assert(
      Math.abs(down.level - 0.5) < 1e-3,
      `the macro at rest gives ${down.level}`
    );
    assert(
      Math.abs(up.level - 1) < 1e-2,
      `the macro turned up gives ${up.level}, not 1`
    );
  }
);

/** A drum rack of `pads` on a MIDI track playing `notes`, rendered for half a second with a recording `hit`, an impulse on its first frame. */
function throughDrums(
  pads: {
    devices?: ReturnType<typeof device>[];
    mix?: { gain: number; muted: boolean; pan: number; soloed: boolean };
    note: number;
    sound: DrumSound;
  }[],
  notes: { pitch: number; velocity: number }[]
) {
  const doc = arrangement({
    clips: [
      {
        ...clip("m", "beat", 0, 1),
        notes: notes.map((note, index) => ({
          id: `n${index}`,
          length: 0.1,
          start: 0.1,
          ...note,
        })),
        recording: undefined,
      },
    ],
    tracks: [
      {
        color: 0,
        devices: [
          {
            device: DRUM_RACK_DEVICE,
            id: "drums",
            instrument: true,
            rack: {
              chains: pads.map((pad, index) => ({
                devices: pad.devices ?? [],
                id: `pad-${index}`,
                name: `Pad ${index}`,
                pad: { note: pad.note, sound: pad.sound },
                ...(pad.mix ? { mix: pad.mix } : {}),
              })),
              macros: [],
            },
            state: {},
          },
        ],
        id: "beat",
        kind: "midi",
        name: "Beat",
      },
    ],
  });
  return render(doc, new Map([["hit", impulse(0.5, 0)]]), 0.5);
}

const hit: DrumSound = { decay: 2, kind: "sample", recording: "hit", tune: 0 };

check(
  "DEV-013: a note plays the pads that answer it, on its frame, as loud as its velocity",
  async () => {
    const out = await throughDrums(
      [
        { note: 39, sound: hit },
        { note: 36, sound: { ...hit, recording: "none" } },
      ],
      [{ pitch: 39, velocity: 0.5 }]
    );
    const { at, level } = loudestOf(out);
    assert(at === 4800, `the pad sounds at frame ${at}, not 4800`);
    assert(Math.abs(level - 0.25) < 1e-4, `at half velocity it gives ${level}`);
    const none = await throughDrums(
      [{ note: 39, sound: hit }],
      [{ pitch: 60, velocity: 1 }]
    );
    assert(
      none.getChannelData(0).every((sample) => sample === 0),
      "a note no pad answers makes a sound"
    );
  }
);

check(
  "DEV-013: a pad plays through its own devices and its chain's switch, and a synthesized voice sounds",
  async () => {
    const louder = await throughDrums(
      [
        {
          devices: [device("u", "audioui.utility", { gainDb: 6 })],
          note: 39,
          sound: hit,
        },
      ],
      [{ pitch: 39, velocity: 0.5 }]
    );
    const up = loudestOf(louder).level;
    const expected = 0.25 * 10 ** (6 / 20);
    assert(
      Math.abs(up - expected) < 1e-4,
      `+6 dB on the pad gives ${up}, not ${expected}`
    );
    const off = await throughDrums(
      [{ mix: chainMix(1, true), note: 39, sound: hit }],
      [{ pitch: 39, velocity: 1 }]
    );
    assert(
      off.getChannelData(0).every((sample) => sample === 0),
      "a pad switched off sounds"
    );
    const kick = await throughDrums(
      [
        {
          note: 36,
          sound: { decay: 0.2, kind: "synth", tune: 0, voice: "kick" },
        },
      ],
      [{ pitch: 36, velocity: 1 }]
    );
    const data = kick.getChannelData(0);
    const before = Math.max(...data.subarray(0, 4799).map(Math.abs));
    const during = Math.max(...data.subarray(4800, 9600).map(Math.abs));
    assert(before === 0, `the kick sounds before its note (${before})`);
    assert(during > 0.3, `the kick is near silent (${during})`);
  }
);

check(
  "DEV-007: a device removed from a track's chain, on or switched off, leaves the rest of the chain playing",
  async () => {
    const ctx = new OfflineAudioContext(2, RATE / 2, RATE);
    const engine = await createArrangementEngine(ctx);
    assert(engine, "the engine loads");
    const take = recording(0.5);
    const recordings = new Map([["take", take]]);
    const withDevices = (devices: TrackDevice[]) =>
      arrangement({
        clips: [clip("a", "vox", 0, 0.5)],
        tracks: [{ color: 0, devices, id: "vox", name: "Vox" }],
      });
    const on = device("on", "audioui.utility");
    const off = { ...device("off", "audioui.utility"), on: false };
    const kept = device("kept", "audioui.utility", { gainDb: 6 });
    engine.update(withDevices([on, off, kept]), recordings as never);
    await engine.ready();
    try {
      engine.update(withDevices([off, kept]), recordings as never);
      engine.update(withDevices([kept]), recordings as never);
    } catch (error) {
      throw new Error(`removing a device throws: ${(error as Error).message}`, {
        cause: error,
      });
    }
    engine.play(0, 0);
    const out = (await ctx.startRendering()).getChannelData(0);
    engine.dispose();
    const loudest = Math.max(...out.map(Math.abs));
    assert(loudest > 0.5, `the device left plays the take at ${loudest}`);
  }
);
