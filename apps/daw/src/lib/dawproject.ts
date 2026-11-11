import type { ParameterValue } from "@audio-ui/core/device";
import type { Breakpoint } from "@audio-ui/core/envelope";
import type { Note } from "@audio-ui/core/piano-roll";
import type { WarpMode } from "@audio-ui/core/playback";
import type { Tempo } from "@audio-ui/core/time";
import {
  type Arranged,
  type ArrangementTrack,
  type AutomatedParameter,
  mixOf,
  type TrackColor,
  type TrackDevice,
  volumeGain,
  volumeValue,
} from "@/lib/arrangement";
import {
  type ArrangementDoc,
  type ArrangementLocator,
  type ArrangementSignature,
  createArrangementState,
} from "@/lib/arrangement-state";
import { compressorDevice } from "@/components/audio-ui/devices/compressor/device";
import {
  EQUALIZER_BANDS,
  equalizerDevice,
} from "@/components/audio-ui/devices/equalizer/device";
import { gateDevice } from "@/components/audio-ui/devices/gate/device";
import { limiterDevice } from "@/components/audio-ui/devices/limiter/device";
import { createZip, readZip } from "@/lib/zip";

/** A recording an export packs: its file's name in the archive's `audio/` folder, its length in seconds, its channels and rate. */
export interface DawprojectRecording {
  channels: number;
  file: string;
  length: number;
  sampleRate: number;
}

/** A recording an import brings: the id its clips name it by, a name, and its file's bytes. */
export interface ImportedRecording {
  bytes: ArrayBuffer;
  id: string;
  name: string;
}

type Attributes = Record<string, string | number | boolean | undefined>;

const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** An element, its attributes in the order given, and its children, indented. */
function element(
  name: string,
  attributes: Attributes = {},
  children: readonly string[] = []
): string {
  const written = Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${escape(String(value))}"`)
    .join("");
  if (children.length === 0) {
    return `<${name}${written}/>`;
  }
  const inner = children.join("\n").replaceAll("\n", "\n  ");
  return `<${name}${written}>\n  ${inner}\n</${name}>`;
}

const real = (
  name: string,
  id: string,
  value: number,
  unit: string,
  range: { max?: number; min?: number } = {}
) => element(name, { id, max: range.max, min: range.min, unit, value });

const bool = (name: string, id: string, value: boolean) =>
  element(name, { id, value });

/** The colors tracks are written with, by the index a track keeps. */
const COLORS = ["#e5484d", "#f5a524", "#30a46c", "#3e63dd", "#8e4ec6"];

const HEX_COLOR = /^#[0-9a-f]{6}$/;

/** A color a track is written with: a palette index as its hex, a color of the user's own as it is. */
function writtenColor(color: TrackColor): string {
  return typeof color === "string"
    ? color
    : (COLORS[color % COLORS.length] as string);
}

/** The color a track is read back with: a palette color as its index, another hex as it is, and none by the track's place in the order. */
function readColor(written: string | null, index: number): TrackColor {
  const hex = written?.trim().toLowerCase() ?? "";
  const palette = COLORS.indexOf(hex);
  if (palette >= 0) {
    return palette;
  }
  return HEX_COLOR.test(hex) ? hex : index;
}

const TYPE_TO_DAWPROJECT: Record<string, string> = {
  highcut: "lowPass",
  highshelf: "highShelf",
  lowcut: "highPass",
  lowshelf: "lowShelf",
  notch: "notch",
  peak: "bell",
};

const num = (value: ParameterValue | undefined) => Number(value ?? 0);

/** A device of the four the format describes, or null for one it does not. */
function writeDevice(device: TrackDevice): string | null {
  const { state } = device;
  const on = device.on !== false && state.enabled !== false;
  const id = `device-${device.id}`;
  const at = (name: string) => `${id}-${name}`;
  const common = {
    deviceID: device.device,
    deviceRole: "audioFX",
    id,
    loaded: true,
  };
  const enabled = bool("Enabled", at("on"), on);
  switch (device.device) {
    case "audioui.equalizer":
      return element("Equalizer", { ...common, deviceName: "Equalizer" }, [
        enabled,
        ...EQUALIZER_BANDS.map((band, order) =>
          element(
            "Band",
            {
              order,
              type: TYPE_TO_DAWPROJECT[String(state[band.type])] ?? "bell",
            },
            [
              real("Freq", at(`${band.id}-freq`), num(state[band.hz]), "hertz"),
              real(
                "Gain",
                at(`${band.id}-gain`),
                num(state[band.db]),
                "decibel"
              ),
              real("Q", at(`${band.id}-q`), num(state[band.q]), "linear"),
            ]
          )
        ),
        real("OutputGain", at("output"), num(state.outputDb), "decibel"),
      ]);
    case "audioui.compressor":
      return element("Compressor", { ...common, deviceName: "Compressor" }, [
        enabled,
        real("Attack", at("attack"), num(state.attackMs) / 1000, "seconds"),
        bool("AutoMakeup", at("auto"), false),
        real("OutputGain", at("output"), num(state.makeupDb), "decibel"),
        real("Ratio", at("ratio"), num(state.ratio), "linear"),
        real("Release", at("release"), num(state.releaseMs) / 1000, "seconds"),
        real("Threshold", at("threshold"), num(state.thresholdDb), "decibel"),
      ]);
    case "audioui.gate":
      return element("NoiseGate", { ...common, deviceName: "Gate" }, [
        enabled,
        real("Attack", at("attack"), num(state.attackMs) / 1000, "seconds"),
        real("Range", at("range"), num(state.floorDb), "decibel"),
        real("Release", at("release"), num(state.releaseMs) / 1000, "seconds"),
        real("Threshold", at("threshold"), num(state.thresholdDb), "decibel"),
      ]);
    case "audioui.limiter":
      return element("Limiter", { ...common, deviceName: "Limiter" }, [
        enabled,
        real("InputGain", at("input"), num(state.gainDb), "decibel"),
        real("Release", at("release"), num(state.releaseMs) / 1000, "seconds"),
        real("Threshold", at("threshold"), num(state.ceilingDb), "decibel"),
      ]);
    default:
      return null;
  }
}

/** What a track of the arrangement holds, as the format names it. */
const CONTENT_OF_KIND = { audio: "audio", group: "tracks", midi: "notes" };
const contentOfKind = (track: ArrangementTrack) =>
  CONTENT_OF_KIND[track.kind ?? "audio"];

/** Where a channel plays into: its group's channel, or the main track's; the main track plays out. */
function destinationOf(track: ArrangementTrack, role: string) {
  if (role === "master") {
    return;
  }
  return track.group ? `channel-${track.group}` : "channel-main";
}

/** A track and its channel: its devices, volume, pan, mute, solo and sends; a group, its tracks within it. */
function writeTrack(
  track: ArrangementTrack,
  role: "effect" | "master" | "regular" | "submix",
  report: string[],
  returnsById: ReadonlyMap<string, ArrangementTrack>,
  inner: readonly string[] = []
): string {
  const mix = mixOf(track);
  const devices: string[] = [];
  for (const device of track.devices ?? []) {
    const written = writeDevice(device);
    if (written) {
      devices.push(written);
    } else {
      report.push(
        `${track.name}: ${device.device.replace("audioui.", "")} left out`
      );
    }
  }
  const sends = Object.entries(track.sends ?? {}).filter(([id]) =>
    returnsById.has(id)
  );
  const channel = element(
    "Channel",
    {
      audioChannels: 2,
      destination: destinationOf(track, role),
      id: role === "master" ? "channel-main" : `channel-${track.id}`,
      role,
      solo: mix.soloed,
    },
    [
      ...(devices.length > 0 ? [element("Devices", {}, devices)] : []),
      bool("Mute", `mute-${track.id}`, mix.muted),
      real("Pan", `pan-${track.id}`, (mix.pan + 1) / 2, "normalized", {
        max: 1,
        min: 0,
      }),
      ...(sends.length > 0
        ? [
            element(
              "Sends",
              {},
              sends.map(([id, gain]) =>
                element(
                  "Send",
                  {
                    destination: `channel-${id}`,
                    id: `send-${track.id}-${id}`,
                    type: returnsById.get(id)?.pre ? "pre" : "post",
                  },
                  [
                    real(
                      "Volume",
                      `send-${track.id}-${id}-volume`,
                      gain,
                      "linear",
                      { max: 1, min: 0 }
                    ),
                  ]
                )
              )
            ),
          ]
        : []),
      real("Volume", `volume-${track.id}`, mix.gain, "linear", {
        max: 2,
        min: 0,
      }),
    ]
  );
  const contentType =
    role === "regular" || role === "submix"
      ? contentOfKind(track)
      : "audio notes";
  return element(
    "Track",
    {
      color: writtenColor(track.color),
      contentType,
      id: role === "master" ? "track-main" : `track-${track.id}`,
      loaded: true,
      name: track.name,
    },
    [channel, ...inner]
  );
}

/** An audio clip: its content always in a warp map, so its own time is the map's whatever its source. */
function writeAudioClip(
  clip: Arranged,
  recording: DawprojectRecording,
  report: string[]
): string {
  const { value } = clip;
  if (clip.reversed) {
    report.push(`${clip.name}: played backwards, written forwards`);
  }
  if ((clip.gain ?? 0) !== 0) {
    report.push(`${clip.name}: its gain of ${clip.gain} dB left out`);
  }
  if ((clip.transpose ?? 0) !== 0) {
    report.push(`${clip.name}: its transposition left out`);
  }
  const from = clip.sourceFrom ?? 0;
  const markers =
    clip.warp && clip.warp.length > 1
      ? clip.warp.map((marker) => ({
          content: from + marker.source,
          time: marker.target,
        }))
      : [
          { content: from, time: 0 },
          { content: from + clip.sourceLength, time: clip.sourceLength },
        ];
  return element(
    "Clip",
    {
      contentTimeUnit: "seconds",
      duration: value.length,
      enable: clip.disabled ? false : undefined,
      fadeInTime: value.fadeIn,
      fadeOutTime: value.fadeOut,
      fadeTimeUnit: "seconds",
      loopEnd: clip.loop?.[1],
      loopStart: clip.loop?.[0],
      name: clip.name,
      playStart: value.offset,
      time: value.start,
    },
    [
      element(
        "Warps",
        {
          contentTimeUnit: "seconds",
          id: `warps-${clip.id}`,
          timeUnit: "seconds",
        },
        [
          element(
            "Audio",
            {
              ...(clip.warpMode ? { algorithm: clip.warpMode } : {}),
              channels: recording.channels,
              duration: recording.length,
              id: `audio-${clip.id}`,
              sampleRate: recording.sampleRate,
            },
            [element("File", { path: `audio/${recording.file}` })]
          ),
          ...markers.map((marker) =>
            element("Warp", { contentTime: marker.content, time: marker.time })
          ),
        ]
      ),
    ]
  );
}

function writeMidiClip(clip: Arranged): string {
  const { value } = clip;
  return element(
    "Clip",
    {
      contentTimeUnit: "seconds",
      duration: value.length,
      enable: clip.disabled ? false : undefined,
      loopEnd: clip.loop?.[1],
      loopStart: clip.loop?.[0],
      name: clip.name,
      playStart: value.offset,
      time: value.start,
    },
    [
      element(
        "Notes",
        { id: `notes-${clip.id}`, timeUnit: "seconds" },
        (clip.notes ?? [])
          .filter((note) => !note.muted)
          .map((note) =>
            element("Note", {
              channel: 0,
              duration: note.length,
              key: note.pitch,
              rel: note.velocity ?? 1,
              time: note.start,
              vel: note.velocity ?? 1,
            })
          )
      ),
    ]
  );
}

/** A track's envelopes of volume and pan, at their times in the song; those of its devices are left out, said in `report`. */
function writeAutomation(
  track: ArrangementTrack,
  duration: number,
  report: string[]
): string[] {
  const entries = Object.entries(track.automation ?? {}) as [
    AutomatedParameter,
    readonly Breakpoint[],
  ][];
  const parameters = entries.filter(
    (entry): entry is ["pan" | "volume", readonly Breakpoint[]] =>
      entry[0] === "volume" || entry[0] === "pan"
  );
  if (parameters.length < entries.length) {
    report.push(`${track.name}: the automation of its devices left out`);
  }
  return parameters.map(([parameter, points]) =>
    element(
      "Points",
      {
        id: `points-${track.id}-${parameter}`,
        unit: parameter === "volume" ? "linear" : "normalized",
      },
      [
        element("Target", { parameter: `${parameter}-${track.id}` }),
        ...points.map((point) =>
          element("RealPoint", {
            interpolation: "linear",
            time: point.x * duration,
            value: parameter === "volume" ? volumeGain(point.y) : point.y,
          })
        ),
      ]
    )
  );
}

/**
 * The project's `project.xml` and `metadata.xml`, and what they leave out. Every
 * time is in seconds; the tempo and the time signatures are written beside
 * them for a DAW that counts in beats.
 */
export function writeDawproject(
  doc: ArrangementDoc,
  recordings: ReadonlyMap<string, DawprojectRecording>,
  application = { name: "audio/ui", version: "1" }
): { metadata: string; project: string; report: string[] } {
  const report: string[] = [];
  const returnsById = new Map(doc.returns.map((track) => [track.id, track]));
  const ids = new Set(doc.tracks.map((track) => track.id));
  const nested = (track: ArrangementTrack): string =>
    writeTrack(
      track,
      track.kind === "group" ? "submix" : "regular",
      report,
      returnsById,
      doc.tracks.filter((each) => each.group === track.id).map(nested)
    );
  const structure = [
    ...doc.tracks
      .filter((track) => !(track.group && ids.has(track.group)))
      .map(nested),
    ...doc.returns.map((track) =>
      writeTrack(track, "effect", report, returnsById)
    ),
    writeTrack(doc.main, "master", report, returnsById),
  ];
  const lanes = [...doc.tracks, ...doc.returns].map((track) => {
    const clips = doc.clips
      .filter((clip) => clip.track === track.id)
      .flatMap((clip) => {
        if (clip.notes) {
          return [writeMidiClip(clip)];
        }
        const recording = clip.recording
          ? recordings.get(clip.recording)
          : undefined;
        if (!recording) {
          report.push(`${clip.name}: its recording is missing, left out`);
          return [];
        }
        return [writeAudioClip(clip, recording, report)];
      });
    return element(
      "Lanes",
      { id: `lanes-${track.id}`, track: `track-${track.id}` },
      [
        element("Clips", { id: `clips-${track.id}` }, clips),
        ...writeAutomation(track, doc.duration, report),
      ]
    );
  });
  if (doc.loop.on) {
    report.push("The loop left out: the format has none");
  }
  const { tempo } = doc;
  const changes = doc.signatures;
  const arrangement = element("Arrangement", { id: "arrangement" }, [
    ...(changes.length > 0
      ? [
          element(
            "TimeSignatureAutomation",
            { id: "signatures", timeUnit: "seconds" },
            [
              element("Target", { parameter: "signature" }),
              ...changes.map((change) =>
                element("TimeSignaturePoint", {
                  denominator: change.beatUnit,
                  numerator: change.beatsPerBar,
                  time: change.at,
                })
              ),
            ]
          ),
        ]
      : []),
    element("Lanes", { id: "lanes", timeUnit: "seconds" }, lanes),
    ...(doc.locators.length > 0
      ? [
          element(
            "Markers",
            { id: "markers", timeUnit: "seconds" },
            doc.locators.map((locator) =>
              element("Marker", { name: locator.name, time: locator.at })
            )
          ),
        ]
      : []),
  ]);
  const project = element("Project", { version: "1.0" }, [
    element("Application", application),
    element("Transport", {}, [
      real("Tempo", "tempo", tempo.bpm, "bpm", { max: 999, min: 20 }),
      element("TimeSignature", {
        denominator: tempo.beatUnit,
        id: "signature",
        numerator: tempo.beatsPerBar,
      }),
    ]),
    element("Structure", {}, structure),
    arrangement,
    element("Scenes"),
  ]);
  return {
    metadata: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<MetaData/>\n`,
    project: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${project}\n`,
    report,
  };
}

/** A whole `.dawproject` file: the documents and the audio of every recording a clip plays, read with `bytesOf`. */
export async function exportDawproject(
  doc: ArrangementDoc,
  recordings: ReadonlyMap<string, DawprojectRecording>,
  bytesOf: (id: string) => Promise<ArrayBuffer | null>
): Promise<{ file: Blob; report: string[] }> {
  const played = new Set(doc.clips.map((clip) => clip.recording));
  const present = new Map<string, DawprojectRecording>();
  const audio: { data: Uint8Array<ArrayBuffer>; path: string }[] = [];
  await [...recordings].reduce(async (done, [id, recording]) => {
    await done;
    const bytes = played.has(id) ? await bytesOf(id) : null;
    if (bytes) {
      present.set(id, recording);
      audio.push({
        data: new Uint8Array(bytes),
        path: `audio/${recording.file}`,
      });
    }
  }, Promise.resolve());
  const { metadata, project, report } = writeDawproject(doc, present);
  const file = await createZip([
    { data: project, path: "project.xml" },
    { data: metadata, path: "metadata.xml" },
    ...audio,
  ]);
  return { file, report };
}

// Reading -------------------------------------------------------------------

type TimeUnit = "beats" | "seconds";

const kids = (parent: Element, name: string) =>
  [...parent.children].filter((child) => child.tagName === name);
const kid = (parent: Element, name: string) => kids(parent, name)[0];
const numberAt = (el: Element | undefined, name: string, fallback = 0) => {
  const value = Number(el?.getAttribute(name));
  return Number.isFinite(value) && el?.hasAttribute(name) ? value : fallback;
};

/** The time unit an element counts in: its own, or its clip's content's, or what it sits in. */
function unitOf(el: Element | null): TimeUnit {
  if (!el) {
    return "beats";
  }
  const own = el.getAttribute("timeUnit");
  if (own === "beats" || own === "seconds") {
    return own;
  }
  const parent = el.parentElement;
  if (parent?.tagName === "Clip") {
    const content = parent.getAttribute("contentTimeUnit");
    return content === "beats" || content === "seconds"
      ? content
      : unitOf(parent.parentElement);
  }
  return unitOf(parent);
}

/** A parameter's value in the unit asked for, from the unit it was written in. */
function valueIn(
  el: Element | undefined,
  wanted: "decibel" | "linear" | "seconds"
): number | null {
  if (!el?.hasAttribute("value")) {
    return null;
  }
  const value = Number(el.getAttribute("value"));
  const unit = el.getAttribute("unit");
  if (wanted === "decibel" && unit === "linear") {
    return value > 0 ? 20 * Math.log10(value) : -96;
  }
  if (wanted === "linear" && unit === "decibel") {
    return 10 ** (value / 20);
  }
  return value;
}

const TYPE_FROM_DAWPROJECT: Record<string, string> = {
  bell: "peak",
  highPass: "lowcut",
  highShelf: "highshelf",
  lowPass: "highcut",
  lowShelf: "lowshelf",
  notch: "notch",
};

/** One of the four devices the format describes, as ours, or null with a line of the report. */
function readDevice(
  el: Element,
  index: number,
  track: string,
  report: string[]
): TrackDevice | null {
  const enabled = kid(el, "Enabled")?.getAttribute("value") !== "false";
  const seconds = (name: string) => {
    const value = valueIn(kid(el, name), "seconds");
    return value === null ? undefined : value * 1000;
  };
  const decibel = (name: string) =>
    valueIn(kid(el, name), "decibel") ?? undefined;
  const made = (
    device: {
      defaults: () => Record<string, ParameterValue>;
      id: string;
      sanitize: (state: never) => Record<string, ParameterValue>;
    },
    patch: Record<string, ParameterValue | undefined>
  ): TrackDevice => {
    const state = { ...device.defaults() };
    for (const [key, value] of Object.entries(patch)) {
      if (
        value !== undefined &&
        !(typeof value === "number" && Number.isNaN(value))
      ) {
        state[key] = value;
      }
    }
    return {
      device: device.id,
      id: `${track}-device-${index + 1}`,
      ...(enabled ? {} : { on: false }),
      state: device.sanitize(state as never),
    };
  };
  switch (el.tagName) {
    case "Equalizer": {
      const bands = kids(el, "Band").sort(
        (a, b) => numberAt(a, "order") - numberAt(b, "order")
      );
      if (bands.length > EQUALIZER_BANDS.length) {
        report.push(`${track}: an equalizer's bands past the fourth left out`);
      }
      const patch: Record<string, ParameterValue | undefined> = {
        outputDb: decibel("OutputGain"),
      };
      for (const [at, band] of bands
        .slice(0, EQUALIZER_BANDS.length)
        .entries()) {
        const ours = EQUALIZER_BANDS[at];
        if (ours) {
          patch[ours.type] =
            TYPE_FROM_DAWPROJECT[band.getAttribute("type") ?? ""] ?? "peak";
          patch[ours.hz] = valueIn(kid(band, "Freq"), "linear") ?? undefined;
          patch[ours.db] = valueIn(kid(band, "Gain"), "decibel") ?? undefined;
          patch[ours.q] = valueIn(kid(band, "Q"), "linear") ?? undefined;
        }
      }
      return made(equalizerDevice, patch);
    }
    case "Compressor":
      return made(compressorDevice, {
        attackMs: seconds("Attack"),
        makeupDb: decibel("OutputGain"),
        ratio: valueIn(kid(el, "Ratio"), "linear") ?? undefined,
        releaseMs: seconds("Release"),
        thresholdDb: decibel("Threshold"),
      });
    case "NoiseGate":
      return made(gateDevice, {
        attackMs: seconds("Attack"),
        floorDb: decibel("Range"),
        releaseMs: seconds("Release"),
        thresholdDb: decibel("Threshold"),
      });
    case "Limiter":
      return made(limiterDevice, {
        ceilingDb: decibel("Threshold"),
        gainDb: decibel("InputGain"),
        releaseMs: seconds("Release"),
      });
    default:
      report.push(
        `${track}: ${el.getAttribute("deviceName") ?? el.tagName} left out`
      );
      return null;
  }
}

/** What an import knows of a channel: whose it is, and the ids of its volume and pan, which automation targets. */
interface ReadChannel {
  pan: string | null;
  track: ArrangementTrack;
  volume: string | null;
}

/** What a track of the format holds, as ours names it. */
function kindOf(el: Element, content: string): ArrangementTrack["kind"] {
  if (isGroup(el)) {
    return "group";
  }
  return content.split(" ").includes("notes") && !content.includes("audio")
    ? "midi"
    : "audio";
}

function readTrack(
  el: Element,
  index: number,
  report: string[]
): { channel: Element | undefined; role: string; track: ArrangementTrack } {
  const channel = kid(el, "Channel");
  const name = el.getAttribute("name") ?? `Track ${index + 1}`;
  const id = `track-${index + 1}`;
  const content = el.getAttribute("contentType") ?? "audio";
  const devices = channel
    ? (kid(channel, "Devices")
        ? [...(kid(channel, "Devices") as Element).children]
        : []
      )
        .map((device, at) => readDevice(device, at, name, report))
        .filter((device): device is TrackDevice => device !== null)
    : [];
  const volume = valueIn(
    channel ? kid(channel, "Volume") : undefined,
    "linear"
  );
  const pan = channel ? kid(channel, "Pan") : undefined;
  const panValue = pan?.hasAttribute("value")
    ? Number(pan.getAttribute("value"))
    : 0.5;
  const color = readColor(el.getAttribute("color"), index);
  const track: ArrangementTrack = {
    color,
    ...(devices.length > 0 ? { devices } : {}),
    id,
    kind: kindOf(el, content),
    mix: {
      color,
      gain: volume ?? 1,
      muted: channel
        ? kid(channel, "Mute")?.getAttribute("value") === "true"
        : false,
      pan:
        pan?.getAttribute("unit") === "normalized" || !pan?.hasAttribute("unit")
          ? panValue * 2 - 1
          : panValue,
      soloed: channel?.getAttribute("solo") === "true",
    },
    name,
  };
  return { channel, role: channel?.getAttribute("role") ?? "regular", track };
}

/** Every track of the structure, a group's tracks after it, flattened; groups themselves are reported. */
function flatTracks(
  structure: Element,
  parent: Element | null = null
): { el: Element; parent: Element | null }[] {
  return kids(structure, "Track").flatMap((track) => [
    { el: track, parent },
    ...flatTracks(track, track),
  ]);
}

/** Whether a track of the format is a group: it holds tracks, or it mixes them. */
const isGroup = (el: Element) =>
  kids(el, "Track").length > 0 ||
  (el.getAttribute("contentType") ?? "").split(" ").includes("tracks") ||
  kid(el, "Channel")?.getAttribute("role") === "submix";

/** A clip's content, through one level of nested clips: its audio and warp map, or its notes. */
function contentOf(
  clip: Element,
  byId: ReadonlyMap<string, Element>
): {
  audio?: Element;
  notes?: Element;
  playStart: number;
  warps?: Element;
} | null {
  const playStart = numberAt(clip, "playStart");
  // An alias clip plays the content of another, named by its id.
  const shared = byId.get(clip.getAttribute("reference") ?? "");
  if (shared?.tagName === "Notes") {
    return { notes: shared, playStart };
  }
  if (shared?.tagName === "Audio") {
    return { audio: shared, playStart };
  }
  if (shared?.tagName === "Warps") {
    return { audio: kid(shared, "Audio"), playStart, warps: shared };
  }
  const warps = kid(clip, "Warps");
  if (warps) {
    return { audio: kid(warps, "Audio"), playStart, warps };
  }
  const audio = kid(clip, "Audio");
  if (audio) {
    return { audio, playStart };
  }
  const notes = kid(clip, "Notes");
  if (notes) {
    return { notes, playStart };
  }
  const inner = kid(clip, "Clips")
    ? kids(kid(clip, "Clips") as Element, "Clip")
    : [];
  const [only] = inner;
  if (inner.length === 1 && only && numberAt(only, "time") === 0) {
    const nested = contentOf(only, byId);
    return nested
      ? { ...nested, playStart: playStart + nested.playStart }
      : null;
  }
  return null;
}

/** What reading one project shares: its tempo, what it found so far, and the report. */
interface Reading {
  automation: {
    at: number;
    parameter: AutomatedParameter;
    track: ArrangementTrack;
    value: number;
  }[];
  bpm: number;
  /** Every element of the project with an id, which another names it by. */
  byId: ReadonlyMap<string, Element>;
  byTrack: Map<string, ArrangementTrack>;
  channels: Map<string, ReadChannel>;
  clips: Arranged[];
  files: Map<string, { id: string; name: string; path: string }>;
  report: string[];
}

const toSeconds = (reading: Reading, value: number, unit: TimeUnit) =>
  unit === "seconds" ? value : (value * 60) / reading.bpm;

const EXTENSION = /\.[^.]+$/;

/** The recording a file of the archive is, made the first time a clip plays it. */
function fileOf(reading: Reading, path: string) {
  const known = reading.files.get(path);
  if (known) {
    return known;
  }
  const made = {
    id: `rec-${reading.files.size + 1}`,
    name: (path.split("/").at(-1) ?? path).replace(EXTENSION, ""),
    path,
  };
  reading.files.set(path, made);
  return made;
}

/** Where a track goes: the main track, a return track, or a track of the arrangement. */
function placed(
  role: string,
  track: ArrangementTrack,
  returns: readonly ArrangementTrack[]
): ArrangementTrack {
  if (role === "master") {
    return { ...track, id: "main" };
  }
  if (role === "effect") {
    return { ...track, id: `return-${returns.length + 1}`, kind: undefined };
  }
  return track;
}

/** Each track's sends, to the return tracks they reach; a pre-fader send makes its return one. */
function readSends(
  reading: Reading,
  sendsOf: readonly { from: ArrangementTrack; sends: Element[] }[],
  returns: readonly ArrangementTrack[]
) {
  for (const { from, sends } of sendsOf) {
    const gains: Record<string, number> = {};
    for (const send of sends) {
      const to = reading.channels.get(
        send.getAttribute("destination") ?? ""
      )?.track;
      if (to && returns.includes(to)) {
        gains[to.id] = valueIn(kid(send, "Volume"), "linear") ?? 0;
        to.pre = to.pre || send.getAttribute("type") === "pre";
      }
    }
    if (Object.keys(gains).length > 0) {
      from.sends = gains;
    }
  }
}

/** The tracks of the structure: those of the arrangement, the return tracks and the main track. */
function readStructure(reading: Reading, structure: Element | undefined) {
  const tracks: ArrangementTrack[] = [];
  const returns: ArrangementTrack[] = [];
  let main: ArrangementTrack = { color: 0, id: "main", name: "Main" };
  const sendsOf: { from: ArrangementTrack; sends: Element[] }[] = [];
  const all = structure ? flatTracks(structure) : [];
  for (const [index, { el, parent }] of all.entries()) {
    const { channel, role, track } = readTrack(el, index, reading.report);
    // A track within a group track plays into it.
    const group = parent
      ? reading.byTrack.get(parent.getAttribute("id") ?? "")?.id
      : undefined;
    const kept = placed(role, group ? { ...track, group } : track, returns);
    if (role === "master") {
      main = kept;
    } else if (role === "effect") {
      returns.push(kept);
    } else {
      tracks.push(kept);
    }
    reading.byTrack.set(el.getAttribute("id") ?? "", kept);
    if (channel) {
      reading.channels.set(channel.getAttribute("id") ?? "", {
        pan: kid(channel, "Pan")?.getAttribute("id") ?? null,
        track: kept,
        volume: kid(channel, "Volume")?.getAttribute("id") ?? null,
      });
      const sends = kid(channel, "Sends");
      if (sends) {
        sendsOf.push({ from: kept, sends: kids(sends, "Send") });
      }
    }
  }
  readSends(reading, sendsOf, returns);
  return { main, returns, tracks };
}

/** What every clip has, whatever it plays: where it lies, its fades, its loop and whether it is on. */
function clipBasics(
  reading: Reading,
  el: Element,
  track: ArrangementTrack,
  playStart: number
) {
  const unit = unitOf(el.parentElement);
  const contentUnit =
    (el.getAttribute("contentTimeUnit") as TimeUnit | null) ?? unit;
  const fadeUnit = (el.getAttribute("fadeTimeUnit") as TimeUnit | null) ?? unit;
  const at = (name: string, inUnit: TimeUnit) =>
    toSeconds(reading, numberAt(el, name), inUnit);
  const looped = el.hasAttribute("loopStart") && el.hasAttribute("loopEnd");
  const loop = looped
    ? ([at("loopStart", contentUnit), at("loopEnd", contentUnit)] as const)
    : undefined;
  return {
    ...(el.getAttribute("enable") === "false" ? { disabled: true } : {}),
    id: `clip-${reading.clips.length + 1}`,
    ...(loop && loop[1] > loop[0] ? { loop } : {}),
    name: el.getAttribute("name") ?? track.name,
    track: track.id,
    value: {
      fadeIn: at("fadeInTime", fadeUnit),
      fadeOut: at("fadeOutTime", fadeUnit),
      length: at("duration", unit),
      offset: toSeconds(reading, playStart, contentUnit),
      start: at("time", unit),
    },
  };
}

type ClipBasics = ReturnType<typeof clipBasics>;

function readMidiClip(reading: Reading, basics: ClipBasics, notesEl: Element) {
  const unit = unitOf(notesEl);
  const notes: Note[] = kids(notesEl, "Note").map((note, index) => ({
    id: index + 1,
    length: toSeconds(reading, numberAt(note, "duration"), unit),
    pitch: numberAt(note, "key", 60),
    start: toSeconds(reading, numberAt(note, "time"), unit),
    velocity: numberAt(note, "vel", 1),
  }));
  const end = Math.max(
    basics.value.offset + basics.value.length,
    basics.loop?.[1] ?? 0,
    ...notes.map((note) => note.start + note.length)
  );
  reading.clips.push({ ...basics, notes, sourceLength: end });
}

/**
 * The warp mode of an `algorithm`, whose names each DAW picks for itself: ours
 * come back as they went, and any other keeps the pitch, as stretching does.
 * With none, the clip plays as a warp does by default.
 */
function warpModeOf(algorithm: string | null): { warpMode?: WarpMode } {
  if (!algorithm) {
    return {};
  }
  const name = algorithm.toLowerCase();
  return {
    warpMode: name === "repitch" || name === "tones" ? name : "beats",
  };
}

/** An audio clip: a warp map that only shifts the recording is a start in it, any other is a warp. */
function readAudioClip(
  reading: Reading,
  basics: ClipBasics,
  audio: Element | undefined,
  warps: Element | undefined
) {
  const path = audio ? kid(audio, "File")?.getAttribute("path") : null;
  if (!(audio && path)) {
    reading.report.push(
      `${basics.name}: its audio file is not named, left out`
    );
    return;
  }
  const duration = numberAt(audio, "duration");
  const { id } = fileOf(reading, path);
  const warpUnit = warps ? unitOf(warps) : "seconds";
  const contentUnit =
    (warps?.getAttribute("contentTimeUnit") as TimeUnit | null) ?? "seconds";
  const points = (warps ? kids(warps, "Warp") : []).map((warp) => ({
    content: toSeconds(reading, numberAt(warp, "contentTime"), contentUnit),
    time: toSeconds(reading, numberAt(warp, "time"), warpUnit),
  }));
  const shift = points[0] ? points[0].content - points[0].time : 0;
  const straight = points.every(
    (point) => Math.abs(point.content - point.time - shift) < 1e-6
  );
  if (straight) {
    const sourceFrom = Math.max(0, shift);
    reading.clips.push({
      ...basics,
      recording: id,
      sourceFrom,
      sourceLength: Math.max(0, duration - sourceFrom),
    });
    return;
  }
  reading.clips.push({
    ...basics,
    recording: id,
    sourceLength: duration,
    warp: points.map((point) => ({
      source: point.content,
      target: point.time,
    })),
    ...warpModeOf(audio.getAttribute("algorithm")),
  });
}

function readClip(reading: Reading, el: Element, track: ArrangementTrack) {
  const content = contentOf(el, reading.byId);
  if (!content) {
    reading.report.push(
      `${el.getAttribute("name") ?? track.name}: a clip of a kind that cannot be read, left out`
    );
    return;
  }
  const basics = clipBasics(reading, el, track, content.playStart);
  if (content.notes) {
    readMidiClip(reading, basics, content.notes);
  } else {
    readAudioClip(reading, basics, content.audio, content.warps);
  }
}

/** A pan point's share, 0 to 1, from a value written normalized or from -1 to 1. */
const panShare = (raw: number, unit: string | null) =>
  unit === "normalized" || !unit ? raw : (raw + 1) / 2;

/** An envelope of a track's volume or pan; one of any other parameter is reported. */
function readPoints(
  reading: Reading,
  el: Element,
  track: ArrangementTrack | undefined
) {
  const target = kid(el, "Target")?.getAttribute("parameter") ?? "";
  const channel = [...reading.channels.values()].find(
    (known) => known.volume === target || known.pan === target
  );
  if (!channel) {
    reading.report.push(
      `${track?.name ?? "A track"}: automation of a parameter that has no counterpart, left out`
    );
    return;
  }
  const parameter: AutomatedParameter =
    channel.volume === target ? "volume" : "pan";
  const unit = unitOf(el);
  const valueUnit = el.getAttribute("unit");
  for (const point of kids(el, "RealPoint")) {
    const raw = numberAt(point, "value");
    const gain = valueUnit === "decibel" ? 10 ** (raw / 20) : raw;
    reading.automation.push({
      at: toSeconds(reading, numberAt(point, "time"), unit),
      parameter,
      track: channel.track,
      value:
        parameter === "volume" ? volumeValue(gain) : panShare(raw, valueUnit),
    });
  }
}

/** The lanes of the arrangement, each with the track its clips and envelopes belong to. */
function walkLanes(
  reading: Reading,
  el: Element,
  track: ArrangementTrack | undefined
) {
  const owner = reading.byTrack.get(el.getAttribute("track") ?? "") ?? track;
  for (const child of el.children) {
    if (child.tagName === "Clips" && owner) {
      for (const clip of kids(child, "Clip")) {
        readClip(reading, clip, owner);
      }
    } else if (child.tagName === "Points") {
      readPoints(reading, child, owner);
    } else if (child.tagName === "Lanes") {
      walkLanes(reading, child, owner);
    }
  }
}

function readLocators(
  reading: Reading,
  arrangement: Element | undefined
): ArrangementLocator[] {
  const markers = arrangement ? kid(arrangement, "Markers") : undefined;
  if (!markers) {
    return [];
  }
  const unit = unitOf(markers);
  return kids(markers, "Marker").map((marker, index) => ({
    at: toSeconds(reading, numberAt(marker, "time"), unit),
    id: `locator-${index + 1}`,
    name: marker.getAttribute("name") ?? `Locator ${index + 1}`,
  }));
}

function readSignatures(
  reading: Reading,
  arrangement: Element | undefined
): ArrangementSignature[] {
  const points = arrangement
    ? kid(arrangement, "TimeSignatureAutomation")
    : undefined;
  if (!points) {
    return [];
  }
  const unit = unitOf(points);
  return kids(points, "TimeSignaturePoint")
    .map((point, index) => ({
      at: toSeconds(reading, numberAt(point, "time"), unit),
      beatUnit: numberAt(point, "denominator", 4),
      beatsPerBar: numberAt(point, "numerator", 4),
      id: `signature-${index + 1}`,
    }))
    .filter((change) => change.at > 0);
}

/** The envelopes found, as shares of the song now that its length is known. */
function placeAutomation(reading: Reading, duration: number) {
  for (const point of reading.automation) {
    const envelope = point.track.automation ?? {};
    const list = [...(envelope[point.parameter] ?? [])];
    list.push({ x: Math.min(1, point.at / duration), y: point.value });
    point.track.automation = { ...envelope, [point.parameter]: list };
  }
}

/**
 * A `project.xml` read into an arrangement: its tracks, return tracks and
 * main track, its clips and automation, its locators, tempo and time
 * signatures; the recordings its audio clips play, by the path of their file
 * in the archive; and what it left out.
 */
export function readDawproject(
  xml: string,
  { colors = 5 }: { colors?: number } = {}
): {
  doc: ArrangementDoc;
  files: { id: string; name: string; path: string }[];
  report: string[];
} {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const project = parsed.documentElement;
  if (project.tagName !== "Project" || parsed.querySelector("parsererror")) {
    throw new Error("This is not a DAWproject project.");
  }
  const transport = kid(project, "Transport");
  const signature = transport ? kid(transport, "TimeSignature") : undefined;
  const bpm = numberAt(
    transport ? kid(transport, "Tempo") : undefined,
    "value",
    120
  );
  const tempo: Tempo = {
    beatUnit: numberAt(signature, "denominator", 4),
    beatsPerBar: numberAt(signature, "numerator", 4),
    bpm,
  };
  const reading: Reading = {
    automation: [],
    bpm,
    byId: new Map(
      [...project.querySelectorAll("[id]")].map((item) => [
        item.getAttribute("id") ?? "",
        item,
      ])
    ),
    byTrack: new Map(),
    channels: new Map(),
    clips: [],
    files: new Map(),
    report: [],
  };
  const { main, returns, tracks } = readStructure(
    reading,
    kid(project, "Structure")
  );
  const arrangement = kid(project, "Arrangement");
  if (arrangement) {
    walkLanes(reading, arrangement, undefined);
    if (kid(arrangement, "TempoAutomation")) {
      reading.report.push(
        "Tempo changes left out: the arrangement keeps its first tempo"
      );
    }
  }
  const locators = readLocators(reading, arrangement);
  // As long as what it holds, and 64 bars at least, as a new project is.
  const duration = Math.max(
    (64 * tempo.beatsPerBar * 4 * 60) / (tempo.beatUnit * bpm),
    ...reading.clips.map((clip) => clip.value.start + clip.value.length),
    ...locators.map((locator) => locator.at),
    ...reading.automation.map((point) => point.at)
  );
  placeAutomation(reading, duration);
  const { doc } = createArrangementState({
    colors,
    duration,
    initialClips: reading.clips,
    initialLocators: locators,
    initialMain: main,
    initialReturns: returns,
    initialSignatures: readSignatures(reading, arrangement),
    initialTracks: tracks,
    tempo,
  });
  return { doc, files: [...reading.files.values()], report: reading.report };
}

/** A whole `.dawproject` file read: the arrangement, the bytes of each recording, and what was left out or is missing. */
export async function importDawproject(
  file: Blob,
  options: { colors?: number } = {}
): Promise<{
  doc: ArrangementDoc;
  recordings: ImportedRecording[];
  report: string[];
}> {
  const entries = await readZip(file);
  const project = entries.get("project.xml");
  if (!project) {
    throw new Error("This archive has no project.xml: it is not a DAWproject.");
  }
  const { doc, files, report } = readDawproject(
    new TextDecoder().decode(await project.read()),
    options
  );
  const recordings: ImportedRecording[] = [];
  await files.reduce(async (done, recording) => {
    await done;
    const entry = entries.get(recording.path);
    if (entry) {
      recordings.push({
        bytes: await entry.read(),
        id: recording.id,
        name: recording.name,
      });
    } else {
      report.push(`${recording.name}: its file is not in the archive`);
    }
  }, Promise.resolve());
  return { doc, recordings, report };
}