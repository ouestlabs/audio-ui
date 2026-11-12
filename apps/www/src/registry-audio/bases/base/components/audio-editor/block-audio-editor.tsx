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
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/registry/bases/base/ui/button-group";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/registry/bases/base/ui/context-menu";
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
import { TimelineTimeSelection } from "@/registry-audio/bases/base/audio/elements/time-selection";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRuler,
  TimelineViewport,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { TimelineLocator } from "@/registry-audio/bases/base/audio/elements/timeline-markers";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import { useArrangement } from "@/registry-audio/bases/base/hooks/use-arrangement";
import { useArrangementEngine } from "@/registry-audio/bases/base/hooks/use-arrangement-engine";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";
import type {
  Arranged,
  Clipping,
  TimeSelection,
} from "@/registry-audio/bases/base/lib/arrangement";
import type {
  ArrangementCommand,
  ArrangementLocator,
} from "@/registry-audio/bases/base/lib/arrangement-state";
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
/** What the editor's recordings are named after, apart from those of other demos on the same context. */
const RECORDING = "audio-editor-sound";
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
/** Narrower than this, the editor starts with its library folded, leaving the chain the room. */
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
/** The systems whose shortcuts take Command. */
const APPLE = /Mac|iPhone|iPad/;
/** How far the arrows move a locator, in seconds. */
const LOCATOR_STEP = 0.1;
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

/** A sound the editor plays: its name, its length, and its peaks for the waveform. */
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
  // As many decimals as the step has itself: a quarter second reads 0:00.25, not 0:00.3.
  const decimals = String(step).split(".")[1]?.length ?? 0;
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

/** Over the waveform, while a file is dragged over the editor: where it lands. */
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

/** Whether a key went to a field you type in, where its keys are its own. */
function typing(target: EventTarget | null) {
  return (
    (target instanceof HTMLInputElement && target.type !== "range") ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Taking the time from `from` to `to` out, the time after it moving in: nothing when it is empty. */
const removing = (from: number, to: number): ArrangementCommand[] =>
  to > from ? [{ from, to, type: "remove-time" }] : [];

/**
 * The edits of the sound, as an audio editor makes them, each one step of
 * undo: on the time selected, Cut and Copy; Paste makes room for what it lays
 * down, over the selection if there is one; Delete and Crop close the gap they
 * leave; Mark puts a locator at the selection's start, or at the cursor. The
 * arrangement's length and loop follow the sound's. `handleKey` is the
 * keyboard of all of them, with Undo and Redo.
 */
function useClipEdits({
  arrangement,
  position,
}: {
  arrangement: ReturnType<typeof useArrangement>;
  position: ReturnType<typeof createSource<number>>;
}) {
  const { copyOf, dispatch, doc } = arrangement;
  const [time, setTime] = useState<TimeSelection | null>(null);
  const [clipboard, setClipboard] = useState<Clipping | null>(null);
  const length = doc.duration;

  /** One step of undo: the edit, then the arrangement's length and loop set to the sound's new length. */
  const commit = useCallback(
    (commands: ArrangementCommand[], next: number) =>
      dispatch({
        commands: [
          ...commands,
          { duration: next, type: "set-duration" },
          { loop: { range: [0, next] }, type: "set-loop" },
        ],
        type: "batch",
      }),
    [dispatch]
  );
  const remove = useCallback(() => {
    if (!time) {
      return;
    }
    const [from, to] = time.range;
    commit(removing(from, to), length - (to - from));
    setTime(null);
    position.set(from);
  }, [commit, length, position, time]);
  const copy = useCallback(() => {
    if (time) {
      setClipboard(copyOf(time));
    }
  }, [copyOf, time]);
  const cut = useCallback(() => {
    if (time) {
      setClipboard(copyOf(time));
      remove();
    }
  }, [copyOf, remove, time]);
  const paste = useCallback(() => {
    if (!clipboard) {
      return;
    }
    const at = time ? time.range[0] : Math.min(position.getSnapshot(), length);
    const over = time ? time.range[1] - time.range[0] : 0;
    commit(
      [
        ...(time ? removing(time.range[0], time.range[1]) : []),
        { at, length: clipboard.length, type: "insert-time" },
        { at, clipping: clipboard, track: TRACK, type: "paste" },
      ],
      length - over + clipboard.length
    );
    setTime({ range: [at, at + clipboard.length], tracks: [TRACK] });
  }, [clipboard, commit, length, position, time]);
  const crop = useCallback(() => {
    if (!time) {
      return;
    }
    const [from, to] = time.range;
    commit([...removing(to, length), ...removing(0, from)], to - from);
    setTime({ range: [0, to - from], tracks: [TRACK] });
    position.set(0);
  }, [commit, length, position, time]);
  const mark = useCallback(
    () =>
      dispatch({
        at: time ? time.range[0] : position.getSnapshot(),
        type: "add-locator",
      }),
    [dispatch, position, time]
  );
  const selectAll = useCallback(
    () => setTime({ range: [0, length], tracks: [TRACK] }),
    [length]
  );
  const clear = useCallback(() => setTime(null), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (typing(event.target)) {
        return;
      }
      const withMod: Record<string, (() => void) | undefined> = {
        a: selectAll,
        c: copy,
        v: paste,
        x: cut,
        y: redo,
        z: event.shiftKey ? redo : undo,
      };
      const alone: Record<string, (() => void) | undefined> = {
        backspace: remove,
        delete: remove,
        escape: clear,
        k: crop,
        m: mark,
      };
      const command = (event.metaKey || event.ctrlKey ? withMod : alone)[
        event.key.toLowerCase()
      ];
      if (command) {
        event.preventDefault();
        command();
      }
    },
    [clear, copy, crop, cut, mark, paste, redo, remove, selectAll, undo]
  );

  return {
    clear,
    clipboard,
    copy,
    crop,
    cut,
    handleKey,
    mark,
    paste,
    redo,
    remove,
    selectAll,
    setTime,
    time,
    undo,
  };
}

/** The key that goes with the others on this system: Command on Apple's, Control elsewhere. */
const modKey = () => (APPLE.test(navigator.userAgent) ? "⌘" : "Ctrl+");

/** The waveform's menu: the edits, each with its key. It renders only while open, so it reads the system then. */
function EditMenu({ edits }: { edits: ReturnType<typeof useClipEdits> }) {
  const mod = modKey();
  const selected = edits.time !== null;
  return (
    <ContextMenuContent className="w-52">
      <ContextMenuItem disabled={!selected} onClick={edits.cut}>
        Cut
        <ContextMenuShortcut>{mod}X</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!selected} onClick={edits.copy}>
        Copy
        <ContextMenuShortcut>{mod}C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!edits.clipboard} onClick={edits.paste}>
        Paste
        <ContextMenuShortcut>{mod}V</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!selected} onClick={edits.remove}>
        Delete
        <ContextMenuShortcut>⌫</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!selected} onClick={edits.crop}>
        Crop
        <ContextMenuShortcut>K</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={edits.mark}>
        Mark
        <ContextMenuShortcut>M</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={edits.selectAll}>
        Select all
        <ContextMenuShortcut>{mod}A</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

/** What a locator's own gestures ask of the arrangement and the transport. */
interface LocatorActions {
  onJump: (at: number) => void;
  onMove: (id: string, to: number) => void;
  onPlay: (at: number) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

/**
 * The lane's zoom, in px per second: fitted to the width at least, as far in
 * as the samples go, a few px apart, and as wide as a lane can be laid out; a
 * take recording stays fitted to the view it records into.
 */
function laneZoom({
  duration,
  sound,
  takeSpan,
  width,
  zoomPx,
}: {
  duration: number;
  sound: Sound | null;
  takeSpan: number | null;
  width: number;
  zoomPx: number | null;
}) {
  const shownDuration = takeSpan ?? duration;
  const fitPx = width > 0 && shownDuration > 0 ? width / shownDuration : 0;
  const rate =
    sound && sound.duration > 0 ? sound.samples.frames / sound.duration : 0;
  const deepest =
    takeSpan === null && duration > 0
      ? Math.min(rate * FRAME_PX, MOST_LANE_PX / duration)
      : 0;
  const zoom = takeSpan === null ? Math.max(zoomPx ?? fitPx, fitPx) : fitPx;
  return {
    fitPx,
    maxZoom: Math.max(fitPx, deepest),
    shownDuration,
    zoom,
    zoomed: fitPx > 0 && zoom > fitPx * 1.001,
  };
}

/** Zoomed in, the view turns the page as the playhead leaves it, while it plays. */
function useFollowPlayhead({
  playing,
  position,
  px,
  viewport,
  zoomed,
}: {
  playing: boolean;
  position: Source<number>;
  px: number;
  viewport: RefObject<HTMLDivElement | null>;
  zoomed: boolean;
}) {
  const view = useRef({ px, zoomed });
  view.current = { px, zoomed };
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
  }, [playing, position, viewport]);
}

/** The stretch of the timeline that shows, in seconds, read as the view scrolls: what the ruler marks. */
function useShownStretch(
  viewport: RefObject<HTMLDivElement | null>,
  zoom: number
) {
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
  }, [viewport, zoom]);
  return shown;
}

/** While a take records, the view it records into, in seconds: MIN_TAKE_SPAN to start, doubled as the take nears its end; null otherwise. */
function useTakeSpan(recording: boolean, clock: Source<number>) {
  const [span, setSpan] = useState<number | null>(null);
  useEffect(() => {
    if (!recording) {
      setSpan(null);
      return;
    }
    let current = MIN_TAKE_SPAN;
    setSpan(current);
    return clock.subscribe(() => {
      if (clock.getSnapshot() > current * TAKE_SPAN_ROOM) {
        current *= 2;
        setSpan(current);
      }
    });
  }, [clock, recording]);
  return span;
}

/** The track's clips on the lane, each drawing its part of the sound it plays, at the clip editor's detail. */
function SoundClips({
  clips,
  hidden,
  sounds,
}: {
  clips: readonly Arranged[];
  /** While a take records over them: kept in place, unseen. */
  hidden: boolean;
  sounds: ReadonlyMap<string, Sound>;
}) {
  return clips.map((clip) => {
    const sound = sounds.get(clip.recording ?? "");
    return sound ? (
      <div
        // Presses go through to the lane, which seeks and selects: a clip here takes no gesture of its own.
        className={cn(
          "pointer-events-none absolute inset-y-0",
          hidden && "invisible"
        )}
        key={clip.id}
        style={{
          left: `calc(var(--timeline-unit) * ${clip.value.start})`,
          width: `calc(var(--timeline-unit) * ${clip.value.length})`,
        }}
      >
        <ClipWaveform
          aria-label={`${sound.name}, waveform`}
          className="inset-y-0 h-full text-foreground"
          clip={{
            sourceLength: clip.sourceLength ?? sound.duration,
            value: { length: clip.value.length, offset: clip.value.offset },
          }}
          peaks={sound.peaks}
          role="img"
          samples={sound.samples}
        />
      </div>
    ) : null;
  });
}

/** The locators, on a strip of their own over the sound, once there is one: Mark puts them there. */
function LocatorLane({
  actions,
  locators,
}: {
  actions: LocatorActions;
  locators: readonly ArrangementLocator[];
}) {
  return locators.length > 0 ? (
    <TimelineLane aria-label="Locators" className="h-6 border-b">
      {locators.map((locator) => (
        <TimelineLocator
          key={locator.id}
          locator={locator}
          step={LOCATOR_STEP}
          {...actions}
        />
      ))}
    </TimelineLane>
  ) : null;
}

/**
 * The sound's lane: the waveform on a timeline, fitted to the width, zoomed
 * with Cmd or Ctrl + wheel down to the samples, the ruler seeking and the
 * navigator moving the view, which turns the page as the playhead leaves it.
 * While a take records, the lane is the take's, drawn as it comes in a view
 * that fits it; while a file is dragged over the editor, it shows where it
 * lands.
 */
function ClipLane({
  clips,
  dropping,
  duration,
  edits,
  locatorActions,
  locators,
  onSeek,
  playing,
  position,
  sounds,
  take,
  takeName,
}: {
  /** The track's clips: one for the sound, several once it is cut. */
  clips: readonly Arranged[];
  dropping: boolean;
  /** How long the sound is, in seconds: the arrangement's length. */
  duration: number;
  edits: ReturnType<typeof useClipEdits>;
  locatorActions: LocatorActions;
  locators: readonly ArrangementLocator[];
  onSeek: (seconds: number) => void;
  playing: boolean;
  position: Source<number>;
  /** Every sound placed, by its recording's id: what each clip draws. */
  sounds: ReadonlyMap<string, Sound>;
  take: ReturnType<typeof useTake>;
  takeName: string;
}) {
  const { clock: takeClock, levels: takeLevels, recording } = take;
  const sound = sounds.get(clips[0]?.recording ?? "") ?? null;
  const surface = useRef<HTMLDivElement>(null);
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
  const takeSpan = useTakeSpan(recording, takeClock);
  const { fitPx, maxZoom, shownDuration, zoom, zoomed } = laneZoom({
    duration,
    sound,
    takeSpan,
    width,
    zoomPx,
  });
  const changeZoom = useCallback((next: number) => setZoomPx(next), []);
  const shown = useShownStretch(viewport, zoom);
  useFollowPlayhead({ playing, position, px: zoom, viewport, zoomed });

  // A press on the lane lets go of the selection, and gives the lane the keys; a drag from there selects.
  const { clear, setTime, time } = edits;
  const press = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button === 0) {
        clear();
      }
      surface.current?.focus({ preventScroll: true });
    },
    [clear]
  );
  const select = useCallback(
    (range: readonly [number, number]) =>
      setTime({ range: [range[0], range[1]], tracks: [TRACK] }),
    [setTime]
  );

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
          {/* Right-click for the edits; pressed, it takes the keys they answer to. */}
          <ContextMenu>
            <ContextMenuTrigger
              aria-label="Sound, waveform: drag to select, right-click to edit"
              className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onKeyDown={edits.handleKey}
              ref={surface}
              role="group"
              tabIndex={0}
            >
              <TimelineViewport
                className="overflow-y-hidden rounded-lg border"
                ref={viewport}
                scrollbar="hidden"
              >
                <TimelineRuler aria-label="Time" getAriaValueText={formatTime}>
                  {rulerLabels(shownDuration, zoom, shown).map((mark) => (
                    <TimelineMark key={mark.at} value={mark.at}>
                      {mark.text}
                    </TimelineMark>
                  ))}
                </TimelineRuler>
                <LocatorLane actions={locatorActions} locators={locators} />
                {/* A press seeks and a drag selects; the clip editor's waveform draws the peaks, then the samples, then a line through them with a dot each. */}
                <TimelineLane
                  className="h-28"
                  onPointerDown={press}
                  onSelectionChange={select}
                  seekable
                >
                  {/* A take recording draws itself as it comes, as the workstation draws one; then it is the sound. */}
                  {recording && takeLevels ? (
                    <ArrangedTake
                      from={0}
                      levels={takeLevels}
                      name={takeName}
                      position={takeClock}
                    />
                  ) : null}
                  <SoundClips
                    clips={clips}
                    hidden={recording}
                    sounds={sounds}
                  />
                  {time && !recording ? (
                    <TimelineTimeSelection range={time.range} />
                  ) : null}
                  <TimelinePlayhead />
                </TimelineLane>
              </TimelineViewport>
            </ContextMenuTrigger>
            <EditMenu edits={edits} />
          </ContextMenu>
          <TimelineNavigator className="mt-2" getAriaValueText={formatTime} />
        </Timeline>
        <DropOverlay dropping={dropping} />
      </div>
    </div>
  );
}

/**
 * An audio editor for one sound: a demo loop, a file of yours (uploaded or
 * dropped) or a take from the microphone, on a track of an arrangement. The
 * transport plays, loops and records; the waveform seeks and zooms down to the
 * samples; the meter and the main volume close the bar; under it, the
 * track's device chain, an equalizer and a compressor to start, with the
 * library beside it to add any effect.
 */
export default function BlockAudioEditor() {
  const arrangement = useArrangement({
    duration: 1,
    initialTracks: TRACKS,
    tempo: demoTempo(DEMO),
  });
  const { dispatch, doc } = arrangement;
  // Every sound placed stays, by its recording's id, so an undo past a new sound brings the old one back whole.
  const [sounds, setSounds] = useState<ReadonlyMap<string, Sound>>(
    () => new Map()
  );
  const [recordings, setRecordings] = useState<
    ReadonlyMap<string, RecordingSource>
  >(() => new Map());
  const clips = useMemo(
    () => doc.clips.filter((clip) => clip.track === TRACK),
    [doc.clips]
  );
  const latestClips = useRef(clips);
  latestClips.current = clips;
  const sound = sounds.get(clips[0]?.recording ?? "") ?? null;
  const { meter, play, playing, position, stop } = useArrangementEngine({
    doc,
    metronome: NO_METRONOME,
    overridden: NOT_MOVED,
    recordings,
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const edits = useClipEdits({ arrangement, position });
  const { clear: clearSelection } = edits;

  // The engine keeps a recording by its id once it has it: each sound placed takes an id of its own.
  const placed = useRef(0);
  /** Puts a sound on the track: its recording, and a clip that loops it from its start to its end. */
  const place = useCallback(
    (decoded: RecordingSource, next: Sound) => {
      placed.current += 1;
      const id = `${RECORDING}-${placed.current}`;
      setSounds((current) => new Map(current).set(id, next));
      setRecordings((current) => new Map(current).set(id, decoded));
      clearSelection();
      dispatch({
        commands: [
          ...latestClips.current.map((clip) => ({
            id: clip.id,
            type: "remove-clip" as const,
          })),
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
    [clearSelection, dispatch]
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

  // A locator's own gestures: press to put the cursor there, double-click to play from there, drag, rename, delete.
  const locatorActions = useMemo<LocatorActions>(
    () => ({
      onJump: (at) => position.set(at),
      onMove: (id, to) => dispatch({ id, to, type: "move-locator" }),
      onPlay: (at) => play(at),
      onRemove: (id) => dispatch({ id, type: "remove-locator" }),
      onRename: (id, name) => dispatch({ id, name, type: "rename-locator" }),
    }),
    [dispatch, play, position]
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
  // A sound file dropped anywhere on the editor opens in it, and the waveform shows where while it is dragged over;
  // a device dragged from the library goes to the chain.
  const frame = useRef<HTMLDivElement>(null);
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
    <div className="@container w-full min-w-0" ref={frame}>
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
          <ButtonGroup>
            <Toolbar.Button
              aria-label="Undo"
              disabled={!arrangement.canUndo}
              onClick={edits.undo}
              render={<Button size="icon" variant="outline" />}
              title="Undo"
            >
              <IconPlaceholder
                hugeicons="Undo02Icon"
                lucide="Undo2Icon"
                phosphor="ArrowUUpLeftIcon"
                remixicon="RiArrowGoBackLine"
                tabler="IconArrowBackUp"
              />
            </Toolbar.Button>
            <Toolbar.Button
              aria-label="Redo"
              disabled={!arrangement.canRedo}
              onClick={edits.redo}
              render={<Button size="icon" variant="outline" />}
              title="Redo"
            >
              <IconPlaceholder
                hugeicons="Redo02Icon"
                lucide="Redo2Icon"
                phosphor="ArrowUUpRightIcon"
                remixicon="RiArrowGoForwardLine"
                tabler="IconArrowForwardUp"
              />
            </Toolbar.Button>
          </ButtonGroup>
          {/* The output closes the bar, at its end: the level of what comes out, framed as the position is, and the main volume. */}
          <div className="ms-auto flex items-center gap-2">
            <ButtonGroup className="self-stretch">
              <ButtonGroupText>
                <div className="w-20">
                  <Meter
                    aria-label="Output"
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
        clips={clips}
        dropping={dropping}
        duration={doc.duration}
        edits={edits}
        locatorActions={locatorActions}
        locators={doc.locators}
        onSeek={seek}
        playing={playing}
        position={position}
        sounds={sounds}
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
    </div>
  );
}
