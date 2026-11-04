import { describe, expect, test } from "bun:test";
import type { Arranged } from "@/registry-audio/bases/base/lib/arrangement";
import { createArrangementState } from "@/registry-audio/bases/base/lib/arrangement-state";
import { compressorDevice } from "@/registry-audio/bases/base/lib/compressor-device";
import {
  exportDawproject,
  importDawproject,
  readDawproject,
  writeDawproject,
} from "@/registry-audio/bases/base/lib/dawproject";
import { equalizerDevice } from "@/registry-audio/bases/base/lib/equalizer-device";

const TEMPO = { beatUnit: 4, beatsPerBar: 4, bpm: 120 };

const audioClip: Arranged = {
  id: "clip-a",
  loop: [0.5, 1.5],
  name: "Groove",
  recording: "rec-a",
  sourceFrom: 0.25,
  sourceLength: 3,
  track: "drums",
  value: { fadeIn: 0.1, fadeOut: 0.2, length: 4, offset: 0.5, start: 2 },
};
const warpedClip: Arranged = {
  id: "clip-w",
  name: "Stretched",
  recording: "rec-a",
  reversed: true,
  sourceLength: 3,
  track: "drums",
  value: { fadeIn: 0, fadeOut: 0, length: 4, offset: 0, start: 8 },
  warp: [
    { source: 0, target: 0 },
    { source: 3, target: 4 },
  ],
};
const midiClip: Arranged = {
  id: "clip-m",
  name: "Chords",
  notes: [
    { id: 1, length: 0.5, pitch: 60, start: 0, velocity: 0.8 },
    { id: 2, length: 1, pitch: 64, start: 1, velocity: 0.5 },
  ],
  sourceLength: 2,
  track: "keys",
  value: { fadeIn: 0, fadeOut: 0, length: 2, offset: 0, start: 4 },
};

function project() {
  return createArrangementState({
    colors: 5,
    duration: 32,
    initialClips: [audioClip, warpedClip, midiClip],
    initialLocators: [{ at: 4, id: "verse", name: "Verse & bridge" }],
    initialMain: {
      color: 0,
      id: "main",
      mix: { color: 0, gain: 0.8, muted: false, pan: 0, soloed: false },
      name: "Main",
    },
    initialReturns: [
      {
        color: 1,
        devices: [{ device: "audioui.reverb", id: "verb", state: {} }],
        id: "hall",
        name: "Hall",
        pre: true,
      },
    ],
    initialSignatures: [{ at: 16, beatUnit: 8, beatsPerBar: 7, id: "s" }],
    initialTracks: [
      {
        automation: {
          pan: [
            { x: 0, y: 0.25 },
            { x: 1, y: 0.75 },
          ],
          volume: [
            { x: 0, y: 0.5 },
            { x: 0.5, y: 0.9 },
          ],
        },
        color: 0,
        devices: [
          {
            device: "audioui.equalizer",
            id: "eq",
            state: { ...equalizerDevice.defaults(), lowDb: 3, lowHz: 120 },
          },
          {
            device: "audioui.compressor",
            id: "comp",
            on: false,
            state: {
              ...compressorDevice.defaults(),
              ratio: 6,
              thresholdDb: -24,
            },
          },
        ],
        id: "drums",
        kind: "audio",
        mix: { color: 0, gain: 0.5, muted: true, pan: -0.5, soloed: true },
        name: "Drums",
        sends: { hall: 0.3 },
      },
      { color: 1, id: "keys", kind: "midi", name: "Keys" },
    ],
    initialLoop: { on: true, range: [0, 4] },
    tempo: TEMPO,
  }).doc;
}

const RECORDINGS = new Map([
  [
    "rec-a",
    { channels: 2, file: "Groove.wav", length: 3.5, sampleRate: 48_000 },
  ],
]);

describe("DAWproject", () => {
  test("PRJ-008: an arrangement comes back from its project.xml as it went", () => {
    const doc = project();
    const { project: xml, report } = writeDawproject(doc, RECORDINGS);
    const { doc: back, files } = readDawproject(xml);
    expect(files).toEqual([
      { id: "rec-1", name: "Groove", path: "audio/Groove.wav" },
    ]);
    expect(back.tempo).toEqual(TEMPO);
    expect(back.locators.map(({ at, name }) => ({ at, name }))).toEqual([
      { at: 4, name: "Verse & bridge" },
    ]);
    expect(
      back.signatures.map(({ at, beatUnit, beatsPerBar }) => ({
        at,
        beatUnit,
        beatsPerBar,
      }))
    ).toEqual([{ at: 16, beatUnit: 8, beatsPerBar: 7 }]);
    const [drums, keys] = back.tracks;
    expect(drums?.name).toBe("Drums");
    expect(drums?.mix).toMatchObject({ gain: 0.5, muted: true, soloed: true });
    expect(drums?.mix?.pan).toBeCloseTo(-0.5);
    expect(keys?.kind).toBe("midi");
    expect(back.main.mix?.gain).toBe(0.8);
    expect(back.returns.map((track) => [track.name, track.pre])).toEqual([
      ["Hall", true],
    ]);
    expect(drums?.sends).toEqual({ [back.returns[0]?.id ?? ""]: 0.3 });
    const devices = drums?.devices ?? [];
    expect(devices.map((device) => [device.device, device.on])).toEqual([
      ["audioui.equalizer", undefined],
      ["audioui.compressor", false],
    ]);
    expect(devices[0]?.state).toMatchObject({ lowDb: 3, lowHz: 120 });
    expect(devices[1]?.state).toMatchObject({ ratio: 6, thresholdDb: -24 });
    const volume = drums?.automation?.volume ?? [];
    expect(volume.map((point) => point.x * back.duration)).toEqual([0, 16]);
    expect(volume[1]?.y).toBeCloseTo(0.9);
    expect((drums?.automation?.pan ?? []).map((point) => point.y)).toEqual([
      0.25, 0.75,
    ]);
    const [groove, stretched, chords] = back.clips;
    expect(groove).toMatchObject({
      loop: [0.5, 1.5],
      name: "Groove",
      recording: "rec-1",
      sourceFrom: 0.25,
      value: { fadeIn: 0.1, fadeOut: 0.2, length: 4, offset: 0.5, start: 2 },
    });
    expect(stretched?.warp).toEqual([
      { source: 0, target: 0 },
      { source: 3, target: 4 },
    ]);
    expect(
      chords?.notes?.map(({ length, pitch, start, velocity }) => ({
        length,
        pitch,
        start,
        velocity,
      }))
    ).toEqual([
      { length: 0.5, pitch: 60, start: 0, velocity: 0.8 },
      { length: 1, pitch: 64, start: 1, velocity: 0.5 },
    ]);
    expect(report).toEqual([
      "Hall: reverb left out",
      "Stretched: played backwards, written forwards",
      "The loop left out: the format has none",
    ]);
  });

  test("PRJ-008: a project another DAW wrote in beats, its audio in a clip within a clip, reads in seconds", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project version="1.0">
  <Transport>
    <Tempo unit="bpm" value="90" id="t"/>
    <TimeSignature numerator="3" denominator="4" id="s"/>
  </Transport>
  <Structure>
    <Track contentType="audio" id="a" name="Loop">
      <Channel role="regular" id="ca" destination="cm">
        <Devices>
          <ClapPlugin deviceName="Some Synth" id="p"/>
          <Limiter id="l"><Threshold unit="linear" value="0.5" id="lt"/></Limiter>
        </Devices>
        <Volume unit="linear" value="0.5" id="va"/>
        <Pan unit="normalized" value="1" id="pa"/>
      </Channel>
    </Track>
    <Track contentType="notes" id="n" name="Bass">
      <Channel role="regular" id="cn"/>
    </Track>
    <Track contentType="audio notes" id="m" name="Master">
      <Channel role="master" id="cm"/>
    </Track>
  </Structure>
  <Arrangement id="arr">
    <Lanes timeUnit="beats" id="l0">
      <Lanes track="a" id="l1">
        <Clips id="c1">
          <Clip time="3" duration="6" playStart="1.5" name="Funk">
            <Clips id="c2">
              <Clip time="0" duration="6" contentTimeUnit="beats" playStart="0">
                <Warps contentTimeUnit="seconds" id="w">
                  <Audio channels="2" duration="4" sampleRate="44100" id="au"><File path="audio/Funk 90.wav"/></Audio>
                  <Warp time="0" contentTime="0"/>
                  <Warp time="6" contentTime="3"/>
                </Warps>
              </Clip>
            </Clips>
          </Clip>
        </Clips>
        <Points id="pt" unit="linear">
          <Target parameter="va"/>
          <RealPoint time="0" value="1"/>
          <RealPoint time="3" value="0"/>
        </Points>
      </Lanes>
      <Lanes track="n" id="l2">
        <Clips id="c3">
          <Clip time="0" duration="3">
            <Notes id="ns"><Note time="1.5" duration="0.75" channel="0" key="40" vel="0.5"/></Notes>
          </Clip>
        </Clips>
      </Lanes>
    </Lanes>
    <Markers id="mk"><Marker time="6" name="Drop"/></Markers>
  </Arrangement>
</Project>`;
    const { doc, files, report } = readDawproject(xml);
    expect(doc.tempo).toEqual({ beatUnit: 4, beatsPerBar: 3, bpm: 90 });
    const [loop, bass] = doc.tracks;
    expect(loop?.mix).toMatchObject({ gain: 0.5, pan: 1 });
    expect(loop?.devices?.map((device) => device.device)).toEqual([
      "audioui.limiter",
    ]);
    expect(Number(loop?.devices?.[0]?.state.ceilingDb)).toBeCloseTo(-6.02, 1);
    expect(bass?.kind).toBe("midi");
    // 90 beats a minute: a beat is two thirds of a second.
    const [funk, line] = doc.clips;
    expect(funk?.value.start).toBeCloseTo(2);
    expect(funk?.value.length).toBeCloseTo(4);
    expect(funk?.value.offset).toBeCloseTo(1);
    expect(funk?.warp).toEqual([
      { source: 0, target: 0 },
      { source: 3, target: 4 },
    ]);
    expect(files).toEqual([
      { id: "rec-1", name: "Funk 90", path: "audio/Funk 90.wav" },
    ]);
    expect(line?.notes?.[0]).toMatchObject({ pitch: 40, velocity: 0.5 });
    expect(line?.notes?.[0]?.start).toBeCloseTo(1);
    expect(doc.locators[0]?.at).toBeCloseTo(4);
    expect(loop?.automation?.volume?.map((point) => point.y)).toEqual([
      expect.closeTo(60 / 66, 3),
      0,
    ]);
    expect(report).toEqual(["Loop: Some Synth left out"]);
  });

  test("PRJ-008: an alias clip plays the notes of the clip it names, as the format's own tests write one", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project version="1.0">
  <Application name="Test" version="1.0"/>
  <Transport><Tempo unit="bpm" value="120" id="t"/></Transport>
  <Structure>
    <Track contentType="notes" id="id1" name="Track 1" color="#000000">
      <Channel role="regular" id="id2" destination="id0"/>
    </Track>
    <Track contentType="" id="m" name="Master"><Channel role="master" id="id0"/></Track>
  </Structure>
  <Arrangement id="a">
    <Lanes timeUnit="beats" id="l0">
      <Lanes track="id1" id="l1">
        <Clips id="c">
          <Clip time="0" duration="4" name="Clip 0">
            <Notes id="id5"><Note time="0" duration="0.5" key="36" vel="0.8" rel="0.5"/></Notes>
          </Clip>
          <Clip time="32" duration="4" name="Alias Clip 0" reference="id5"/>
        </Clips>
      </Lanes>
    </Lanes>
  </Arrangement>
</Project>`;
    const { doc, report } = readDawproject(xml);
    expect(report).toEqual([]);
    const [clip, alias] = doc.clips;
    expect(alias?.name).toBe("Alias Clip 0");
    // 120 beats a minute: beat 32 is 16 seconds in.
    expect(alias?.value.start).toBeCloseTo(16);
    expect(alias?.notes).toEqual(clip?.notes);
  });

  test("PRJ-008: what is not a DAWproject is refused, saying so", () => {
    expect(() => readDawproject("<Something/>")).toThrow("not a DAWproject");
  });

  test("PRJ-008: a whole file goes out with its audio and comes back with it", async () => {
    const audio = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
    const { file } = await exportDawproject(
      project(),
      RECORDINGS,
      async () => audio.buffer
    );
    const { doc, recordings } = await importDawproject(file);
    expect(doc.tracks.length).toBe(2);
    expect(recordings.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "rec-1", name: "Groove" },
    ]);
    expect(new Uint8Array(recordings[0]?.bytes ?? new ArrayBuffer(0))).toEqual(
      audio
    );
  });

  test("PRJ-008 and MIX-020: groups within groups go out as tracks within tracks, mixed into their group, and come back as groups", () => {
    const { doc } = createArrangementState({
      colors: 5,
      duration: 8,
      initialTracks: [
        { color: 0, id: "band", kind: "group", name: "Band" },
        { color: 1, group: "band", id: "drums", kind: "group", name: "Drums" },
        { color: 2, group: "drums", id: "kick", name: "Kick" },
        { color: 3, group: "band", id: "bass", name: "Bass" },
        { color: 4, id: "vocal", name: "Vocal" },
      ],
      tempo: TEMPO,
    });
    const { project: xml } = writeDawproject(doc, new Map());
    expect(xml).toContain('role="submix"');
    expect(xml).toContain('destination="channel-drums"');
    const back = readDawproject(xml).doc.tracks;
    const byName = new Map(back.map((track) => [track.name, track]));
    const groupOf = (name: string) => {
      const id = byName.get(name)?.group;
      return back.find((track) => track.id === id)?.name;
    };
    expect(back.map((track) => track.name)).toEqual([
      "Band",
      "Drums",
      "Kick",
      "Bass",
      "Vocal",
    ]);
    expect(byName.get("Drums")?.kind).toBe("group");
    expect([
      groupOf("Drums"),
      groupOf("Kick"),
      groupOf("Bass"),
      groupOf("Vocal"),
    ]).toEqual(["Band", "Drums", "Band", undefined]);
  });
});
