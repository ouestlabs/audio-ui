"use client";

import {
  type AudioPeaks,
  computePeaks,
  dbToGain,
  gainToDb,
  normalizePeaks,
} from "@audio-ui/engine/analysis";
import { decodeAudioChannels } from "@audio-ui/engine/files";
import { secondsPerBeat, type Tempo } from "@audio-ui/engine/time";
import { createSource, type Source } from "@audio-ui/react";
import { Toolbar } from "@base-ui/react/toolbar";
import {
  type ChangeEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/registry/bases/base/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import { ArrangedTake } from "@/registry-audio/bases/base/audio/elements/arranged-clip";
import {
  type ClipSamples,
  ClipWaveform,
} from "@/registry-audio/bases/base/audio/elements/clip-waveform";
import { DeviceBrowser } from "@/registry-audio/bases/base/audio/elements/device-browser";
import { DeviceView } from "@/registry-audio/bases/base/audio/elements/device-view";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRuler,
  TimelineViewport,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import { useArrangement } from "@/registry-audio/bases/base/hooks/use-arrangement";
import { useArrangementEngine } from "@/registry-audio/bases/base/hooks/use-arrangement-engine";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";
import type { Arranged } from "@/registry-audio/bases/base/lib/arrangement";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";
import {
  DEMO_SOURCES,
  type DemoSource,
  type DemoSourceName,
  demoTempo,
  renderDemoSource,
} from "@/registry-audio/bases/base/lib/demo-sound";
import {
  DEVICE_SHELVES,
  libraryDevice,
} from "@/registry-audio/bases/base/lib/device-library";
import {
  createInputRecorder,
  type InputRecorder,
  playCountIn,
} from "@/registry-audio/bases/base/lib/input-recorder";
import {
  blockPeak,
  type RecordedBlock,
  sliceBlocks,
} from "@/registry-audio/bases/base/lib/recording";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const TRACK = "track-1";
/** What the playground's recordings are named after, apart from those of the registry's demos on the same context. */
const RECORDING = "home-sound";
const DEMO: DemoSourceName = "groove";
/** The demo sounds the menu offers: those to listen through, not the keys a gate follows. */
const DEMOS = (Object.keys(DEMO_SOURCES) as DemoSourceName[]).filter(
  (name) => !(DEMO_SOURCES[name] as DemoSource).isKey
);
/** The menu's value for a sound of your own. */
const UPLOADED = "uploaded";
/** Enough peaks for a pixel each, zoomed in as far as it goes. */
const PEAK_COUNT = 8192;
/** How far in the view zooms: to the samples themselves, this many px apart, as the clip editor goes. */
const FRAME_PX = 40;
/** The widest a lane can be laid out, in px. */
const MOST_LANE_PX = 16_000_000;
/** How far in from the view's edge the playhead may go before the view turns the page, as a share of the view. */
const PAGE_MARGIN = 0.1;
const LABEL_STEPS = [
  0.0001, 0.000_25, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25,
  0.5, 1, 2, 5, 10, 15, 30, 60,
];
const MIN_LABEL_GAP_PX = 56;
/** Narrower than this, the playground starts with its library folded, leaving the chain the room. */
const LIBRARY_PX = 600;
const NO_ANALYSERS: readonly AnalyserNode[] = [];
/** How far ahead of now a take (or its count-in) starts, in seconds: room for the first click to be scheduled. */
const COUNT_IN_LEAD = 0.05;
/** A take shorter than this, in seconds, is dropped: it ended within the count-in. */
const SHORTEST_TAKE = 0.1;
/** How long a stretch each level of a take drawn live covers, in seconds, as the workstation draws one. */
const LEVEL_SECONDS = 0.02;
/** The shortest view a take records into, in seconds: it doubles whenever the take nears its end. */
const MIN_TAKE_SPAN = 8;
/** How far along the view a take goes before the view doubles, as a share of it. */
const TAKE_SPAN_ROOM = 0.9;
/** The main volume's range, in dB, as a mixer's fader has it. */
const MIN_DB = -60;
const MAX_DB = 6;
const formatDb = (db: number) =>
  db <= MIN_DB ? "-∞ dB" : `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;

/** The chain the sound starts through: an equalizer, then a compressor. */
const START = ["audioui.equalizer", "audioui.compressor"].flatMap(
  (device, index) => {
    const entry = libraryDevice(device);
    return entry
      ? [{ device, id: `start-${index}`, state: entry.device.defaults() }]
      : [];
  }
);
const TRACKS = [{ color: 0, devices: START, id: TRACK, name: "Sound" }];

/** The library's effects, by shelf: the track plays a sound, so it takes no instrument. */
const SHELVES = DEVICE_SHELVES.map((shelf) => ({
  items: shelf.devices
    .map((entry) => entry.device)
    .filter((device) => device.kind !== "instrument"),
  label: shelf.label,
})).filter((shelf) => shelf.items.length > 0);

/** The metronome stays off: the sound is the only thing that plays. */
const NO_METRONOME = { on: false, rhythm: "auto" } as const;
/** Nothing moved by hand: no envelope is drawn, so none is overridden. */
const NOT_MOVED = {};
/** What the chain asks of a host with notes and pads: a sound has neither. */
const IGNORE = () => undefined;

/** A sound the playground plays: its name, its length, and its peaks for the waveform. */
interface Sound {
  /** The demo it is, or null for a file of yours. */
  demo: DemoSourceName | null;
  duration: number;
  name: string;
  peaks: AudioPeaks;
  /** Its samples, mixed to one channel, for a zoom closer than the peaks have detail for. */
  samples: ClipSamples;
}

/** The clip that plays the recording `recording` on the track, over `length` seconds, round and round. */
function loopClip(recording: string, length: number): Arranged {
  return {
    id: "loop",
    loop: [0, length],
    name: "Loop",
    recording,
    sourceLength: length,
    track: TRACK,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start: 0 },
  };
}

/** The channels mixed to one, as the waveform draws the sound. */
function mixOf(channels: readonly Float32Array[]) {
  const [first] = channels;
  const mix = new Float32Array(first?.length ?? 0);
  for (const channel of channels) {
    for (let index = 0; index < mix.length; index += 1) {
      mix[index] = (mix[index] ?? 0) + (channel[index] ?? 0) / channels.length;
    }
  }
  return mix;
}

function soundOf(
  channels: Float32Array[],
  sampleRate: number,
  name: string,
  demo: DemoSourceName | null = null
): Sound {
  const mix = mixOf(channels);
  return {
    demo,
    duration: mix.length / sampleRate,
    name,
    peaks: normalizePeaks(computePeaks(channels, PEAK_COUNT)),
    samples: { frames: mix.length, read: (from, to) => mix.subarray(from, to) },
  };
}

/** The seconds the ruler labels: the smallest step that keeps labels apart at this zoom, in pixels per second. */
function rulerLabels(
  duration: number,
  zoom: number,
  [from, to]: readonly [number, number]
) {
  const step =
    LABEL_STEPS.find((candidate) => candidate * zoom >= MIN_LABEL_GAP_PX) ??
    LABEL_STEPS.at(-1) ??
    1;
  // Only those around what shows: zoomed to the samples, the whole sound would be tens of thousands.
  const first = Math.max(0, Math.floor(from / step) - 1);
  const last = Math.min(Math.floor(duration / step), Math.ceil(to / step) + 1);
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => {
    const at = Number(((first + index) * step).toFixed(6));
    return { at, text: formatMark(at, decimals) };
  });
}

/** A ruler mark: whole seconds as m:ss, finer ones with as many decimals as the step has. */
const formatMark = (seconds: number, decimals: number) =>
  decimals === 0
    ? formatTime(seconds)
    : `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(decimals).padStart(3 + decimals, "0")}`;

/** Scrolls a zoomed view to the page that holds `x`, once the playhead nears or passes its edge. */
function followPlayhead(viewport: HTMLElement | null, x: number) {
  if (!viewport) {
    return;
  }
  const margin = viewport.clientWidth * PAGE_MARGIN;
  const { clientWidth, scrollLeft } = viewport;
  if (x < scrollLeft || x > scrollLeft + clientWidth - margin) {
    viewport.scrollLeft = Math.max(0, x - margin);
  }
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/**
 * The levels of a take as its blocks come in, from the clock frame
 * `gate.from` on: the loudest of each `LEVEL_SECONDS`, published as they fill.
 */
function liveLevels(rate: number) {
  const list: number[] = [];
  const levels = createSource<readonly number[]>(list);
  const gate = { from: Number.POSITIVE_INFINITY };
  const span = Math.round(LEVEL_SECONDS * rate);
  let peak = 0;
  let filled = 0;
  const hear = (block: RecordedBlock) => {
    if (block.frame < gate.from) {
      return;
    }
    peak = Math.max(peak, blockPeak(block));
    filled += block.channels[0]?.length ?? 0;
    if (filled >= span) {
      list.push(peak);
      peak = 0;
      filled = 0;
      levels.set([...list]);
    }
  };
  return { gate, hear, levels };
}

/**
 * A take from the microphone: `record(true)` asks for it and starts after the
 * count-in, `end` (or `record(false)`) stops and hands the take to `onTake`,
 * in channels at the context's rate. `onStart` stops what plays first, so the
 * speakers never come back in through the microphone. `clock` counts the take
 * in seconds, negative through the count-in, for a transport to read, and
 * `levels` what came in so far, for the take to be drawn as it records.
 */
function useTake({
  onStart,
  onTake,
  tempo,
}: {
  onStart: () => void;
  onTake: (channels: Float32Array[], sampleRate: number) => void;
  tempo: Tempo;
}) {
  const [recording, setRecording] = useState(false);
  const [countIn, setCountIn] = useState(0);
  const [clock] = useState(() => createSource(0));
  const [levels, setLevels] = useState<Source<readonly number[]> | null>(null);
  const take = useRef<{
    from: number;
    recorder: InputRecorder;
    source: MediaStreamAudioSourceNode;
    stream: MediaStream;
  } | null>(null);

  const start = useCallback(async () => {
    const ctx = webAudio.resume();
    if (!ctx || take.current) {
      return;
    }
    onStart();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
    } catch {
      return;
    }
    const drawn = liveLevels(ctx.sampleRate);
    const recorder = await createInputRecorder(ctx, drawn.hear);
    if (!recorder) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return;
    }
    const source = ctx.createMediaStreamSource(stream);
    source.connect(recorder.input);
    const beatSeconds = secondsPerBeat(tempo);
    const { beatsPerBar } = tempo;
    const beats = countIn * beatsPerBar;
    const at = ctx.currentTime + COUNT_IN_LEAD;
    playCountIn(ctx, { at, beatSeconds, beats, beatsPerBar });
    recorder.start();
    const from = at + beats * beatSeconds;
    // Drawn from the take's first frame on, after the count-in.
    drawn.gate.from = Math.round(from * ctx.sampleRate);
    take.current = { from, recorder, source, stream };
    setLevels(drawn.levels);
    setRecording(true);
  }, [countIn, onStart, tempo]);

  const end = useCallback(async () => {
    const { current } = take;
    const ctx = webAudio.getContext();
    take.current = null;
    setRecording(false);
    setLevels(null);
    clock.set(0);
    if (!(current && ctx)) {
      return;
    }
    const { currentTime: to, sampleRate } = ctx;
    const blocks = await current.recorder.stop();
    current.source.disconnect();
    for (const track of current.stream.getTracks()) {
      track.stop();
    }
    current.recorder.dispose();
    const channels = sliceBlocks(
      blocks,
      [Math.round(current.from * sampleRate), Math.round(to * sampleRate)],
      2
    );
    // Ended within the count-in, or as good as: there is nothing to keep.
    if ((channels[0]?.length ?? 0) >= sampleRate * SHORTEST_TAKE) {
      onTake(channels, sampleRate);
    }
  }, [clock, onTake]);

  const record = useCallback(
    (on: boolean) => (on ? start() : end()),
    [end, start]
  );

  // The take's clock, read from the audio clock while it records.
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(recording && ctx)) {
      return;
    }
    let frame = 0;
    const tick = () => {
      clock.set(ctx.currentTime - (take.current?.from ?? 0));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock, recording]);

  // The microphone goes when the page does, mid-take or not.
  useEffect(
    () => () => {
      for (const track of take.current?.stream.getTracks() ?? []) {
        track.stop();
      }
      take.current?.recorder.dispose();
    },
    []
  );

  return { clock, countIn, end, levels, record, recording, setCountIn };
}

/** Over the waveform, while a file is dragged over the playground: where it lands. */
function DropOverlay({ dropping }: { dropping: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-primary border-dashed bg-background/85 font-medium text-sm opacity-0 transition-opacity duration-150 motion-reduce:transition-none",
        dropping && "opacity-100"
      )}
    >
      Drop an audio file to play it
    </div>
  );
}

/** The width of an element, measured on the next frame, outside the layout pass that resized it. */
function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let measure = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(measure);
      measure = requestAnimationFrame(() =>
        setWidth(entry?.contentRect.width ?? 0)
      );
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(measure);
      observer.disconnect();
    };
  }, [ref]);
  return width;
}

/**
 * The sound's lane: the waveform on a timeline, fitted to the width, zoomed
 * with Cmd or Ctrl + wheel down to the samples, the ruler seeking and the
 * navigator moving the view, which turns the page as the playhead leaves it.
 * While a take records, the lane is the take's, drawn as it comes in a view
 * that fits it; while a file is dragged over the playground, it shows where it
 * lands.
 */
function ClipLane({
  dropping,
  onSeek,
  playing,
  position,
  sound,
  take,
  takeName,
}: {
  dropping: boolean;
  onSeek: (seconds: number) => void;
  playing: boolean;
  position: Source<number>;
  sound: Sound | null;
  take: ReturnType<typeof useTake>;
  takeName: string;
}) {
  const { clock: takeClock, levels: takeLevels, recording } = take;
  const lane = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const width = useWidth(lane);
  // Pixels per second; null while the whole sound fits the width it is given, and back to null for each new sound.
  const [zoomPx, setZoomPx] = useState<number | null>(null);
  const [zoomedSound, setZoomedSound] = useState(sound);
  if (zoomedSound !== sound) {
    setZoomedSound(sound);
    setZoomPx(null);
  }
  // While a take records, the view is the take's, in seconds; null otherwise.
  const [takeSpan, setTakeSpan] = useState<number | null>(null);
  const soundDuration = sound?.duration ?? 0;
  const shownDuration = takeSpan ?? soundDuration;
  const fitPx = width > 0 && shownDuration > 0 ? width / shownDuration : 0;
  // As far in as the samples go, a few px apart, as wide as a lane can be laid out; a take recording stays fitted.
  const maxZoom = Math.max(
    fitPx,
    sound && soundDuration > 0 && takeSpan === null
      ? Math.min(sound.samples.frames * FRAME_PX, MOST_LANE_PX) / soundDuration
      : 0
  );
  const zoom = takeSpan === null ? Math.max(zoomPx ?? fitPx, fitPx) : fitPx;
  const view = useRef<{ px: number; zoomed: boolean }>({
    px: 0,
    zoomed: false,
  });
  view.current = { px: zoom, zoomed: fitPx > 0 && zoom > fitPx * 1.001 };
  const changeZoom = useCallback((next: number) => setZoomPx(next), []);

  // The stretch that shows, in seconds, for the ruler to mark only that.
  const [shown, setShown] = useState<readonly [number, number]>([0, 0]);
  useEffect(() => {
    const element = viewport.current;
    if (!(element && zoom > 0)) {
      return;
    }
    let pending = 0;
    const measure = () => {
      pending = 0;
      setShown([
        element.scrollLeft / zoom,
        (element.scrollLeft + element.clientWidth) / zoom,
      ]);
    };
    const onScroll = () => {
      pending ||= requestAnimationFrame(measure);
    };
    measure();
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(pending);
      element.removeEventListener("scroll", onScroll);
    };
  }, [zoom]);

  // Zoomed in, the view turns the page as the playhead leaves it.
  useEffect(() => {
    if (!playing) {
      return;
    }
    return position.subscribe(() => {
      if (view.current.zoomed) {
        followPlayhead(
          viewport.current,
          position.getSnapshot() * view.current.px
        );
      }
    });
  }, [playing, position]);

  // While a take records, the view fits it: MIN_TAKE_SPAN to start, doubled as the take nears its end.
  useEffect(() => {
    if (!recording) {
      setTakeSpan(null);
      return;
    }
    let span = MIN_TAKE_SPAN;
    setTakeSpan(span);
    return takeClock.subscribe(() => {
      if (takeClock.getSnapshot() > span * TAKE_SPAN_ROOM) {
        span *= 2;
        setTakeSpan(span);
      }
    });
  }, [recording, takeClock]);

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="relative" ref={lane}>
        <Timeline
          disabled={!sound || recording}
          duration={shownDuration || 1}
          maxZoom={Math.max(maxZoom, 1)}
          minZoom={fitPx || 0}
          onPositionChange={onSeek}
          onZoomChange={changeZoom}
          source={recording ? takeClock : position}
          zoom={fitPx > 0 ? zoom : undefined}
        >
          <TimelineViewport
            className="overflow-y-hidden rounded-lg border"
            ref={viewport}
            scrollbar="hidden"
          >
            <TimelineRuler
              aria-label="Playground time"
              getAriaValueText={formatTime}
            >
              {rulerLabels(shownDuration, zoom, shown).map((mark) => (
                <TimelineMark key={mark.at} value={mark.at}>
                  {mark.text}
                </TimelineMark>
              ))}
            </TimelineRuler>
            {/* A press seeks; the clip editor's waveform draws the peaks, then the samples, then a line through them with a dot each. */}
            <TimelineLane className="h-28" seekable>
              {/* A take recording draws itself as it comes, as the workstation draws one; then it is the sound. */}
              {recording && takeLevels ? (
                <ArrangedTake
                  from={0}
                  levels={takeLevels}
                  name={takeName}
                  position={takeClock}
                />
              ) : null}
              <div
                className={cn(
                  "absolute inset-y-0 left-0",
                  recording && "invisible"
                )}
                style={{
                  width: `calc(var(--timeline-unit) * ${soundDuration || 1})`,
                }}
              >
                {sound ? (
                  <ClipWaveform
                    aria-label={`${sound.name}, waveform`}
                    className="inset-y-0 h-full text-foreground"
                    clip={{
                      sourceLength: soundDuration,
                      value: { length: soundDuration, offset: 0 },
                    }}
                    peaks={sound.peaks}
                    role="img"
                    samples={sound.samples}
                  />
                ) : null}
              </div>
              <TimelinePlayhead />
            </TimelineLane>
          </TimelineViewport>
          <TimelineNavigator className="mt-2" getAriaValueText={formatTime} />
        </Timeline>
        <DropOverlay dropping={dropping} />
      </div>
    </div>
  );
}

/**
 * A working playground made of the registry, under the home's title: a
 * sound (a demo loop, or a file of yours) on a track of an arrangement, with
 * its waveform to seek in and zoom down to the samples, a meter of what comes
 * out, and the track's device chain, an equalizer and a compressor to start,
 * with the library beside it to add any effect of the registry. Each part is
 * named after its registry item, and all of it follows the customizer's
 * style and theme.
 */
export function HomePlayground() {
  const arrangement = useArrangement({
    duration: 1,
    initialTracks: TRACKS,
    tempo: demoTempo(DEMO),
  });
  const { dispatch, doc } = arrangement;
  const [sound, setSound] = useState<Sound | null>(null);
  const [recordings, setRecordings] = useState<
    ReadonlyMap<string, RecordingSource>
  >(() => new Map());
  const { meter, play, playing, position, stop } = useArrangementEngine({
    doc,
    metronome: NO_METRONOME,
    overridden: NOT_MOVED,
    recordings,
  });
  const fileInput = useRef<HTMLInputElement>(null);

  // The engine keeps a recording by its id once it has it: each sound placed takes an id of its own.
  const placed = useRef(0);
  /** Puts a sound on the track: its recording, and a clip that loops it from its start to its end. */
  const place = useCallback(
    (decoded: RecordingSource, next: Sound) => {
      placed.current += 1;
      const id = `${RECORDING}-${placed.current}`;
      setSound(next);
      setRecordings(new Map([[id, decoded]]));
      dispatch({
        commands: [
          { id: "loop", type: "remove-clip" },
          { clip: loopClip(id, next.duration), type: "add-clip" },
          { duration: next.duration, type: "set-duration" },
          {
            loop: { on: true, range: [0, next.duration] },
            type: "set-loop",
          },
        ],
        type: "batch",
      });
    },
    [dispatch]
  );

  /** Puts a demo sound on the track, at its own tempo, for a delay synced to it. */
  const placeDemo = useCallback(
    (buffer: AudioBuffer, name: DemoSourceName) => {
      const channels = Array.from(
        { length: buffer.numberOfChannels },
        (_, channel) => buffer.getChannelData(channel)
      );
      place(
        buffer,
        soundOf(channels, buffer.sampleRate, DEMO_SOURCES[name].title, name)
      );
      dispatch({ tempo: demoTempo(name), type: "set-tempo" });
    },
    [dispatch, place]
  );

  // The demo loop, rendered once the page's context is there.
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    let live = true;
    renderDemoSource(DEMO, ctx.sampleRate).then((buffer) => {
      if (live) {
        placeDemo(buffer, DEMO);
      }
    });
    return () => {
      live = false;
    };
  }, [placeDemo]);

  // A take from the microphone becomes the sound, as a file opened would.
  const takes = useRef(0);
  const takeDone = useCallback(
    (channels: Float32Array[], sampleRate: number) => {
      takes.current += 1;
      position.set(0);
      place(
        { channels, sampleRate },
        soundOf(channels, sampleRate, `Take ${takes.current}`)
      );
    },
    [place, position]
  );
  const take = useTake({ onStart: stop, onTake: takeDone, tempo: doc.tempo });
  const { recording } = take;

  const toggle = useCallback(() => {
    if (recording) {
      take.end();
    } else if (playing) {
      stop();
    } else {
      play(position.getSnapshot());
    }
  }, [play, playing, position, recording, stop, take]);
  // Stop goes back to the start, as a workstation's does; pause stays where it is.
  const rewind = useCallback(() => {
    if (recording) {
      take.end();
      return;
    }
    stop();
    position.set(0);
  }, [position, recording, stop, take]);
  // The main track's volume, in dB; at the bottom of the range it is silence.
  const volume = Math.max(MIN_DB, gainToDb(doc.main.mix?.gain ?? 1));
  const setVolume = useCallback(
    (db: number) =>
      dispatch({
        id: doc.main.id,
        patch: { gain: db <= MIN_DB ? 0 : dbToGain(db) },
        type: "change-mix",
      }),
    [dispatch, doc.main.id]
  );
  const setLooping = useCallback(
    (on: boolean) => dispatch({ loop: { on }, type: "set-loop" }),
    [dispatch]
  );

  const seek = useCallback(
    (value: number) => {
      if (playing) {
        play(value);
      } else {
        position.set(value);
      }
    },
    [play, playing, position]
  );

  const load = useCallback(
    async (file: File) => {
      const ctx = webAudio.getContext();
      if (!ctx) {
        return;
      }
      const channels = await decodeAudioChannels(ctx, await file.arrayBuffer());
      if (!channels[0]) {
        return;
      }
      stop();
      position.set(0);
      place(
        { channels, sampleRate: ctx.sampleRate },
        soundOf(channels, ctx.sampleRate, file.name)
      );
    },
    [place, position, stop]
  );
  // A demo picked in the menu, drawn for the context's rate, from its start.
  const chooseSound = useCallback(
    (value: string) => {
      const ctx = webAudio.getContext();
      if (!(ctx && value in DEMO_SOURCES)) {
        return;
      }
      const name = value as DemoSourceName;
      renderDemoSource(name, ctx.sampleRate).then((buffer) => {
        stop();
        position.set(0);
        placeDemo(buffer, name);
      });
    },
    [placeDemo, position, stop]
  );

  const pick = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        load(file);
      }
      event.target.value = "";
    },
    [load]
  );
  // A sound file dropped anywhere on the playground opens in it, and the waveform shows where while it is dragged over;
  // a device dragged from the library goes to the chain.
  const frame = useRef<HTMLElement>(null);
  const [dropping, setDropping] = useState(false);
  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return;
    }
    const allow = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault();
        setDropping(true);
      }
    };
    const leave = (event: DragEvent) => {
      if (!element.contains(event.relatedTarget as Node | null)) {
        setDropping(false);
      }
    };
    const receive = (event: DragEvent) => {
      setDropping(false);
      const [file] = event.dataTransfer?.files ?? [];
      if (file?.type.startsWith("audio/")) {
        event.preventDefault();
        load(file);
      }
    };
    element.addEventListener("dragover", allow);
    element.addEventListener("dragleave", leave);
    element.addEventListener("drop", receive);
    return () => {
      element.removeEventListener("dragover", allow);
      element.removeEventListener("dragleave", leave);
      element.removeEventListener("drop", receive);
    };
  }, [load]);
  const open = useCallback(() => fileInput.current?.click(), []);

  // The library: picked, a device goes at the end of the chain; the chain's end opens it, ready to search.
  const [libraryOpen, setLibraryOpen] = useState<boolean | null>(null);
  const width = useWidth(frame);
  const search = useRef<HTMLInputElement>(null);
  const openLibrary = useCallback(() => {
    setLibraryOpen(true);
    requestAnimationFrame(() => search.current?.focus());
  }, []);
  const addDevice = useCallback(
    (device: string) => {
      const entry = libraryDevice(device);
      if (entry) {
        dispatch({
          device,
          state: entry.device.defaults(),
          track: TRACK,
          type: "add-device",
        });
      }
    },
    [dispatch]
  );

  const levels = useAudioLevels(meter(doc.main.id) ?? NO_ANALYSERS);

  return (
    <section
      aria-labelledby="home-playground"
      className="@container border-t"
      ref={frame}
    >
      <h2 className="sr-only" id="home-playground">
        Playground
      </h2>
      <input
        accept="audio/*"
        className="sr-only"
        onChange={pick}
        ref={fileInput}
        tabIndex={-1}
        type="file"
      />
      {/* The transport, with the sound and the output as more of its clusters: one bar, one row of arrow keys. */}
      <div className="px-4 pt-4 sm:px-6">
        <Transport
          countIn={take.countIn}
          looping={doc.loop.on}
          onCountInChange={take.setCountIn}
          onLoopingChange={setLooping}
          onPlayPause={toggle}
          onRecordChange={take.record}
          onStop={rewind}
          playing={playing}
          recording={recording}
          source={recording ? take.clock : position}
          tempo={doc.tempo}
        >
          <ButtonGroup>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Toolbar.Button
                    aria-label="Sound"
                    render={<Button size="icon" variant="outline" />}
                    title="Sound"
                  />
                }
              >
                <IconPlaceholder
                  hugeicons="Upload01Icon"
                  lucide="UploadIcon"
                  phosphor="UploadIcon"
                  remixicon="RiUploadLine"
                  tabler="IconUpload"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuItem onClick={open}>
                  Upload a file…
                  <span className="ms-auto text-muted-foreground text-xs">
                    WAV, MP3, FLAC and more
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sound</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    onValueChange={chooseSound}
                    value={sound?.demo ?? UPLOADED}
                  >
                    {sound && sound.demo === null ? (
                      <DropdownMenuRadioItem closeOnClick value={UPLOADED}>
                        <span className="truncate">{sound.name}</span>
                      </DropdownMenuRadioItem>
                    ) : null}
                    {DEMOS.map((name) => (
                      <DropdownMenuRadioItem
                        closeOnClick
                        key={name}
                        value={name}
                      >
                        <span className="flex flex-col gap-0.5">
                          {DEMO_SOURCES[name].title}
                          <span className="text-muted-foreground text-xs">
                            {DEMO_SOURCES[name].about}
                          </span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <p className="px-2 py-1.5 text-muted-foreground text-xs">
                  Or drop an audio file on the waveform.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
          {/* The output closes the bar, at its end: the level of what comes out, framed as the position is, and the main volume. */}
          <div className="ms-auto flex items-center gap-2">
            <ButtonGroup className="self-stretch">
              <ButtonGroupText>
                <div className="w-20">
                  <Meter
                    aria-label="Playground output"
                    orientation="horizontal"
                    peakMarks="hidden"
                    size="sm"
                    source={levels}
                  />
                </div>
              </ButtonGroupText>
            </ButtonGroup>
            {/* In dB as a mixer sets it; its readout hangs over the ruler while it turns, so the bar keeps no room for it. */}
            <Knob
              aria-label="Main volume"
              className="mb-0"
              formatValue={formatDb}
              largeStep={6}
              max={MAX_DB}
              min={MIN_DB}
              onValueChange={setVolume}
              size="xs"
              step={0.5}
              value={volume}
            />
          </div>
        </Transport>
      </div>
      <ClipLane
        dropping={dropping}
        onSeek={seek}
        playing={playing}
        position={position}
        sound={sound}
        take={take}
        takeName={`Take ${takes.current + 1}`}
      />
      {/* The track's chain, from one edge of the inset to the other, the library beside it as in a workstation. */}
      <div className="flex h-96 border-t">
        <DeviceBrowser
          className="h-full"
          onOpenChange={setLibraryOpen}
          onPick={addDevice}
          open={libraryOpen ?? (width === 0 || width >= LIBRARY_PX)}
          searchRef={search}
          shelves={SHELVES}
        />
        <div className="min-w-0 flex-1 bg-muted/30">
          <DeviceView
            arrangement={arrangement}
            onDeviceMoved={IGNORE}
            onHoldNote={IGNORE}
            onNoteOff={IGNORE}
            onNoteOn={IGNORE}
            onOpenLibrary={openLibrary}
            onPadFiles={IGNORE}
            overridden={NOT_MOVED}
            position={position}
            track={TRACK}
          />
        </div>
      </div>
    </section>
  );
}
