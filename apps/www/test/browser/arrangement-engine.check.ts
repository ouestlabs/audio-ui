import type { ParameterValue } from "@audio-ui/core/device";
import type {
  Arranged,
  ArrangementTrack,
  TrackDevice,
} from "@/registry-audio/bases/base/lib/arrangement";
import { renderArrangement } from "@/registry-audio/bases/base/lib/arrangement-engine";
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
    const { createArrangementEngine } = await import(
      "@/registry-audio/bases/base/lib/arrangement-engine"
    );
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
