import { secondsPerBar, type Tempo } from "@audio-ui/core/time";
import { useAppHotkeys, useHotkeys } from "@tanstack/react-hotkeys";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePanelRef } from "react-resizable-panels";
import { toast } from "sonner";
import {
  ArrangementView,
  type ReadingFiles,
} from "@/components/daw/arrangement-view";
import { ClipEditor } from "@/components/daw/clip-editor";
import { DeviceView } from "@/components/daw/device-view";
import { EngineLine } from "@/components/daw/engine-line";
import { LibraryPanel } from "@/components/daw/library-panel";
import { MixerView } from "@/components/daw/mixer-view";
import {
  PanelBar,
  PanelTabs,
  type PanelView,
} from "@/components/daw/panel-strip";
import { TopBar } from "@/components/daw/top-bar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useArrangement } from "@/hooks/use-arrangement";
import { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import { useTimeSelection } from "@/hooks/use-time-selection";
import { useTimelineCursor } from "@/hooks/use-timeline-cursor";
import { useTimelineGrid } from "@/hooks/use-timeline-grid";
import { useTimelineMarkers } from "@/hooks/use-timeline-markers";
import { useTimelineZoom } from "@/hooks/use-timeline-zoom";
import { useTrackAutomation } from "@/hooks/use-track-automation";
import {
  type Arranged,
  type ArrangementTrack,
  padRecordings,
  type TimeSelection,
  type TrackDevice,
} from "@/lib/arrangement";
import { renderArrangement } from "@/lib/arrangement-engine";
import {
  type ArrangementDoc,
  allTracks,
  trackOf,
} from "@/lib/arrangement-state";
import { isComputerKeyboardKey } from "@/lib/computer-keyboard";
import { canStream, streamRecording } from "@/lib/daw/cache";
import { renderConsolidated } from "@/lib/daw/consolidate";
import { addDeviceCommand, takesDevice } from "@/lib/daw/devices";
import { decodeFiles, dropCommands, NEW_TRACK } from "@/lib/daw/drop";
import {
  DAWPROJECT_ACCEPT,
  exportProject,
  importProject,
} from "@/lib/daw/exchange";
import {
  canUseFolders,
  mayWrite,
  pickFolder,
  rememberFolder,
  saveToFolder,
} from "@/lib/daw/folder";
import { projectFromFolder } from "@/lib/daw/open-folder";
import { newProject, TRACK_COLOR_COUNT } from "@/lib/daw/project";
import { freshMidiClipId, nameOf, type Recording } from "@/lib/daw/recordings";
import { ALSO_HOTKEYS, type ShortcutCommand } from "@/lib/daw/shortcuts";
import {
  canStore,
  loadRecording,
  saveProject,
  saveRecording,
} from "@/lib/daw/storage";
import { libraryDevice } from "@/lib/device-library";
import { downloadWavFile } from "@/lib/wav-file";
import { webAudio } from "@/lib/web-audio";
import { RecordSettings } from "./record-settings";
import {
  clipsToReselect,
  readView,
  saveView,
  useForgetRemoved,
  useSavedArrangement,
  useSavedScroll,
  useSavedState,
} from "./use-saved-view";
import { useTake } from "./use-take";
import { useTakeInputs } from "./use-take-inputs";

/** Neither panel scrolls: the timeline and the views scroll inside themselves, and a size rounded under the bar's height shows no scrollbar. The library styles a panel's inner div to scroll, and its `style` comes after. */
const UNSCROLLED = { overflow: "hidden" } as const;

/** The panel under the arrangement folded: its strip alone. */
const STRIP = "2.5rem";
/** The least height of each view of that panel, its strip included: under it, what it shows is cut off. */
const LEAST: Record<PanelView, string> = {
  // A warped clip's Sample box whole: its fields, ÷2 and ×2, and Speed.
  clip: "17.5rem",
  // The tallest device of the library, the compressor, whole, under the strip.
  devices: "22.5rem",
  // A channel whole with a send: name, send, peak, pan, a fader of 5rem, its value and its switches, under the strip.
  mixer: "22.25rem",
};
/** What a rack's title bar takes from the devices in it, in rem: each level of racks adds one. */
const RACK_BAR = 2.5;
/** What a row of sends takes in the mixer, in rem: a knob and its gap. Two sends make a row, and the mixer's least holds one. */
const SEND_ROW = 2.25;
/** The sends a row of a channel holds. */
const SENDS_PER_ROW = 2;

/** How many racks deep a chain goes: 0 with none, 1 with a rack, 2 with a rack in a rack. */
function rackDepth(devices: readonly TrackDevice[] | undefined): number {
  let deepest = 0;
  for (const device of devices ?? []) {
    if (device.rack) {
      const inner = Math.max(
        0,
        ...device.rack.chains.map((chain) => rackDepth(chain.devices))
      );
      deepest = Math.max(deepest, 1 + inner);
    }
  }
  return deepest;
}

/** The most of the window the panel takes when it opens: what a height dragged by hand may go past. */
const OPENING_SHARE = 0.45;
/** How tall each view opens on a tall window, in px. */
const OPENING: Record<PanelView, number> = {
  clip: 288,
  devices: 360,
  mixer: 400,
};
const REM = 16;

/** The least height of a view: for the devices, each level of racks on the track takes a title bar from its devices' height; for the mixer, each row of sends past the first takes a knob's. */
function leastOf(
  view: PanelView,
  devices: readonly TrackDevice[] | undefined,
  sendRows: number
): string {
  if (view === "devices") {
    return `${Number.parseFloat(LEAST.devices) + RACK_BAR * rackDepth(devices)}rem`;
  }
  return view === "mixer"
    ? `${Number.parseFloat(LEAST.mixer) + SEND_ROW * Math.max(0, sendRows - 1)}rem`
    : LEAST[view];
}

/** What tells the panel's view from another: the mixer, once its least grows, is a new one, so it opens at that height. */
function panelKey(view: PanelView, sendRows: number): string {
  return view === "mixer" ? `${view}-${sendRows}` : view;
}

/** How tall a view opens, in px: as tall as it was given, and never under its least, which can have grown since. */
function heightOf(
  kept: number,
  view: PanelView,
  devices: readonly TrackDevice[] | undefined,
  sendRows: number
): number {
  return Math.max(
    kept,
    Number.parseFloat(leastOf(view, devices, sendRows)) * REM
  );
}

/** How tall each view opens on a window `height` px tall: as tall as it likes, up to 45% of it, never under its least. */
function openingHeights(height: number): Record<PanelView, number> {
  const open = (view: PanelView) =>
    Math.max(
      Number.parseFloat(LEAST[view]) * REM,
      Math.min(OPENING[view], Math.round(height * OPENING_SHARE))
    );
  return { clip: open("clip"), devices: open("devices"), mixer: open("mixer") };
}

/** What the panel's bar names: the clip it holds, folded, or the track whose devices it shows; the mixer, nothing. */
function titleOf(
  view: PanelView,
  clip: Arranged | undefined,
  track: ArrangementTrack | undefined
) {
  if (view === "mixer") {
    return;
  }
  return (view === "clip" ? clip?.name : undefined) ?? track?.name;
}

/** How long after a change the project is saved (PRJ-001: within a second). */
const SAVE_MS = 500;

const FIELDS = /^(INPUT|TEXTAREA|SELECT)$/;

/** Whether a key press reached the arrangement itself, rather than a control with arrows of its own. */
function onSurface(target: EventTarget | null) {
  return (
    target === document.body ||
    (target instanceof HTMLElement &&
      target.dataset.slot === "timeline-viewport")
  );
}

/** Whether a key press goes to a field being typed in rather than to the app. */
function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || FIELDS.test(target.tagName))
  );
}

/** What an exchange left out, a few lines of it for a notice. */
function lostLines(report: readonly string[]): string | undefined {
  if (report.length === 0) {
    return;
  }
  const shown = report.slice(0, 4).join("; ");
  return report.length > 4 ? `${shown}; and ${report.length - 4} more` : shown;
}

export interface DawProps {
  /** The folder of the disk the project was opened from or saved to (PRJ-007), if any. */
  folder: FileSystemDirectoryHandle | null;
  initial: ArrangementDoc;
  initialRecordings: ReadonlyMap<string, Recording>;
  /** A project opened from a folder, to take this one's place. */
  onOpen?: (project: DawProps) => void;
}

/**
 * The workstation: the document of the arrangement (`useArrangement`), the
 * recordings it plays, and the engine that plays it (`useArrangementEngine`),
 * with the arrangement, the devices of the selected track, the mixer, the
 * transport and the engine line around them. It holds the start marker and
 * the keyboard; everything else is the registry's.
 */
/** A file let go where nothing takes it would open in the browser, and leave the work behind. */
function refuseFile(event: DragEvent) {
  if (event.dataTransfer?.types.includes("Files") && !event.defaultPrevented) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
  }
}

/** Key presses the workstation has taken, or run a shortcut for: none runs a second one. */
const TAKEN = new WeakSet<KeyboardEvent>();

export function Daw({
  folder: initialFolder,
  initial,
  initialRecordings,
  onOpen,
}: DawProps) {
  const arrangement = useArrangement({
    colors: TRACK_COLOR_COUNT,
    duration: initial.duration,
    initialClips: initial.clips,
    initialFolded: readView().trackFolded,
    initialHeights: readView().trackHeights,
    initialLocators: initial.locators,
    initialLoop: initial.loop,
    initialMain: initial.main,
    initialReturns: initial.returns,
    initialSignatures: initial.signatures,
    initialTracks: initial.tracks,
    tempo: initial.tempo,
  });
  const { dispatch, doc } = arrangement;
  const [recordings, setRecordings] = useState(initialRecordings);
  const sources = useMemo(
    () =>
      new Map([...recordings].map(([id, recording]) => [id, recording.source])),
    [recordings]
  );
  // Automation mode, and the automated gains and pans moved by hand, which play their mix until enabled again.
  const automatedTracks = useMemo(
    () => [...doc.tracks, ...doc.returns],
    [doc.returns, doc.tracks]
  );
  const automation = useTrackAutomation({ dispatch, tracks: automatedTracks });
  const [metronome, setMetronome] = useSavedState("metronome", false);
  const [rhythm, setRhythm] = useSavedState("rhythm", "auto");
  const engine = useArrangementEngine({
    doc,
    metronome: { on: metronome, rhythm },
    overridden: automation.overridden,
    recordings: sources,
  });
  const [cursor, setCursor] = useSavedState(
    "cursor",
    0,
    (seconds) => seconds <= initial.duration
  );
  // The playhead starts at the marker it was left on.
  const [cursorAtOpen] = useState(cursor);
  useEffect(
    () => engine.position.set(cursorAtOpen),
    [cursorAtOpen, engine.position]
  );
  const stoppedAt = useRef(0);
  // Recording (REC): the armed tracks, Record, the count-in and Punch, and the take while it runs.
  const keepTake = useCallback(
    (made: ReadonlyMap<string, Recording>) =>
      setRecordings((current) => new Map([...current, ...made])),
    []
  );
  const take = useTake({
    cursor,
    dispatch,
    doc,
    engine,
    onRecordings: keepTake,
  });
  const {
    armTrack,
    computerKeys,
    computerKeysOn,
    setComputerKeys,
    transportPosition,
  } = useTakeInputs({ doc, engine, take });
  const [selectedTrack, setSelectedTrack] = useSavedState(
    "selectedTrack",
    initial.tracks[0]?.id ?? null,
    (id) => id !== null && trackOf(initial, id) !== undefined
  );
  // Under the arrangement, one panel (MIX-015): the selected clip, the selected track's devices, or the mixer. Like
  // the library, it is always there, folded to its strip or open, its height shared with the tracks by the line above.
  const [panelView, setPanelView] = useSavedState("panelView", "devices");
  useEffect(() => {
    window.addEventListener("dragover", refuseFile);
    window.addEventListener("drop", refuseFile);
    return () => {
      window.removeEventListener("dragover", refuseFile);
      window.removeEventListener("drop", refuseFile);
    };
  }, []);
  const [folded, setFolded] = useSavedState("panelFolded", false);
  const panelRef = usePanelRef();
  const [single] =
    arrangement.selectedIds.length === 1 ? arrangement.selectedIds : [];
  const selectedClip = single
    ? doc.clips.find((clip) => clip.id === single)
    : undefined;
  // The clip view shows the selected clip: with none, the devices.
  const shown = panelView === "clip" && !selectedClip ? "devices" : panelView;
  // How tall each view is, in px: a height dragged is kept for the next time it shows. It opens at no more than
  // 45% of the window, so a short screen keeps room for the tracks, and never under its least height.
  const viewHeights = useRef<Record<PanelView, number>>({
    ...openingHeights(globalThis.innerHeight ?? 900),
    ...readView().panelHeights,
  });
  // The view that has shown at its height since it opened: until then, a report of it folded is not the user's.
  const settled = useRef<PanelView | null>(null);
  // Folded by the line dragged under the view's least height, or opened by dragging it up.
  const keepHeight = useCallback(
    (size: { inPixels: number }, id: string | number | undefined) => {
      // A panel reports under its own id: the view it was, even as another takes its place.
      if (id !== shown) {
        return;
      }
      const collapsed = panelRef.current?.isCollapsed() ?? false;
      // A view opened on the panel open, that reports itself folded before it has shown: it stays open.
      if (collapsed && !folded && settled.current !== shown) {
        panelRef.current?.resize(viewHeights.current[shown]);
        return;
      }
      if (!collapsed) {
        settled.current = shown;
      }
      setFolded(collapsed);
      if (!collapsed) {
        viewHeights.current[shown] = size.inPixels;
        saveView({ panelHeights: { ...viewHeights.current } });
      }
    },
    [folded, panelRef, shown, setFolded]
  );
  const foldPanel = useCallback(
    (fold: boolean) => {
      setFolded(fold);
      if (fold) {
        panelRef.current?.collapse();
      } else {
        panelRef.current?.resize(viewHeights.current[shown]);
      }
    },
    [panelRef, shown, setFolded]
  );
  /** Shows a view, the panel open on it. */
  const showView = useCallback(
    (next: PanelView) => {
      setPanelView(next);
      // Another view comes as a panel of its own, at its own height; the one shown opens where it was.
      if (next === shown) {
        foldPanel(false);
      } else {
        setFolded(false);
      }
    },
    [foldPanel, shown, setPanelView, setFolded]
  );
  const pickView = useCallback(
    (value: unknown) => showView(value as PanelView),
    [showView]
  );
  const showClip = useCallback(() => showView("clip"), [showView]);
  /** A view's key: shows it, or folds the panel when it is what is open. */
  const togglePanel = useCallback(
    (next: PanelView) => {
      if (shown === next && !folded) {
        foldPanel(true);
      } else {
        showView(next);
      }
    },
    [foldPanel, folded, showView, shown]
  );
  // The clip panel's boxes folded, held here so they stay from clip to clip.
  const [clipFolded, setClipFolded] = useSavedState("clipFolded", []);
  // The clip view comes back with the clips it showed, before anything is painted without them.
  const [reselected] = useState(() =>
    clipsToReselect(panelView, initial.clips)
  );
  useLayoutEffect(() => {
    if (reselected.length > 0) {
      dispatch({ ids: reselected, type: "select-clips" });
    }
  }, [dispatch, reselected]);
  // Picking a clip shows it, picking a track its devices, the mixer left where it is.
  useEffect(() => {
    if (single) {
      setPanelView((current) => (current === "mixer" ? current : "clip"));
    }
  }, [single, setPanelView]);
  const pickTrack = useCallback(
    (id: string) => {
      setSelectedTrack(id);
      setPanelView((current) => (current === "mixer" ? current : "devices"));
    },
    [setPanelView, setSelectedTrack]
  );
  // The library on the left (KEY-021), and its search, which the end of a chain focuses.
  const [libraryOpen, setLibraryOpen] = useSavedState("libraryOpen", true);
  const librarySearch = useRef<HTMLInputElement>(null);
  const openLibrary = useCallback(() => {
    setLibraryOpen(true);
    requestAnimationFrame(() => librarySearch.current?.focus());
  }, [setLibraryOpen]);
  /** Puts a device of the library on `onto`, or on a track of its own (DEV-003), and shows it in the device view. */
  const placeDevice = useCallback(
    (device: string, onto: string | null) => {
      const made = addDeviceCommand(doc, device, onto);
      if (made) {
        dispatch(made.command);
        setSelectedTrack(made.track);
        showView("devices");
      }
    },
    [dispatch, doc, showView, setSelectedTrack]
  );
  const pickDevice = useCallback(
    (device: string) => placeDevice(device, selectedTrack),
    [placeDevice, selectedTrack]
  );
  // Dropped, a device goes where it is dropped: a track that cannot take it is left as it is.
  const dropDevice = useCallback(
    (device: string, track: string) => {
      const instrument = libraryDevice(device)?.device.kind === "instrument";
      if (track !== NEW_TRACK && !takesDevice(doc, track, instrument)) {
        toast.error("An instrument goes on a MIDI track.");
        return;
      }
      placeDevice(device, track);
    },
    [doc, placeDevice]
  );
  const addMidiClip = useCallback(
    (track: string, at: number) => {
      const bar = secondsPerBar(doc.tempo);
      dispatch({
        clip: {
          id: freshMidiClipId(new Set(doc.clips.map((clip) => clip.id))),
          loop: [0, bar],
          name: "MIDI clip",
          notes: [],
          sourceLength: bar,
          track,
          value: { fadeIn: 0, fadeOut: 0, length: bar, offset: 0, start: at },
        },
        type: "add-clip",
      });
      showView("clip");
    },
    [dispatch, doc.clips, doc.tempo, showView]
  );
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(
    canStore()
      ? "Saved"
      : "This browser keeps nothing: export to keep your work"
  );

  // Transport (TRN-001 to TRN-004).
  const playFrom = useCallback(
    (from: number) => engine.play(Math.min(Math.max(0, from), doc.duration)),
    [doc.duration, engine]
  );
  const stop = useCallback(() => {
    // Stop ends a take, as Record pressed again does (REC-004).
    if (take.recording) {
      take.finish();
      engine.position.set(cursor);
      return;
    }
    if (engine.playing) {
      stoppedAt.current = engine.engine?.position() ?? cursor;
      engine.stop();
      engine.position.set(cursor);
    } else {
      // Stop pressed while stopped goes back to the start (TRN-003).
      setCursor(0);
      engine.position.set(0);
    }
  }, [
    cursor,
    engine,
    take, // Stop pressed while stopped goes back to the start (TRN-003).
    setCursor,
  ]);
  const playPause = useCallback(
    () => (engine.playing || take.recording ? stop() : playFrom(cursor)),
    [cursor, engine.playing, playFrom, stop, take.recording]
  );
  // Stop then comes back here (ARR-016).
  const playAt = useCallback(
    (seconds: number) => {
      setCursor(seconds);
      playFrom(seconds);
    },
    [playFrom, setCursor]
  );
  const seek = useCallback(
    (seconds: number) => {
      if (engine.playing) {
        playFrom(seconds);
      } else {
        setCursor(seconds);
        engine.position.set(seconds);
      }
    },
    [engine, playFrom, setCursor]
  );
  // The arrangement's zoom and grid, which the keys change too (KEY-016 to KEY-018).
  const viewportRef = useRef<HTMLDivElement>(null);
  const view = useTimelineZoom({
    duration: doc.duration,
    initialZoom: readView().zoom,
    viewportRef,
  });
  const grid = useTimelineGrid({
    initial: readView().grid,
    tempo: doc.tempo,
    zoom: view.zoom,
  });
  useSavedScroll(viewportRef);
  useForgetRemoved(doc);
  useSavedArrangement({
    grid,
    selectedClips: arrangement.selectedIds,
    trackFolded: arrangement.folded,
    trackHeights: arrangement.handHeights,
    zoom: view.timeline.zoom,
  });
  // A change of tempo, or the undo of one, changes the bar: the start marker and the zoom keep their places in it.
  const bar = secondsPerBar(doc.tempo);
  const lastBar = useRef(bar);
  const { rescale } = view;
  const { playing: running, position } = engine;
  useLayoutEffect(() => {
    if (lastBar.current === bar) {
      return;
    }
    const ratio = bar / lastBar.current;
    lastBar.current = bar;
    setCursor((at) => at * ratio);
    if (!running) {
      position.set(position.getSnapshot() * ratio);
    }
    rescale(ratio);
  }, [bar, position, rescale, running, setCursor]);
  // A stretch of time on some tracks, dragged across bare lanes, and what the keys do with it.
  const getCursor = useCallback(() => cursor, [cursor]);
  // The tracks the keys work on: those picked by their headers, or the one last pressed.
  const pickedTracks = useMemo(() => {
    if (arrangement.selectedTracks.length > 0) {
      return arrangement.selectedTracks;
    }
    return selectedTrack ? [selectedTrack] : [];
  }, [arrangement.selectedTracks, selectedTrack]);
  // Cmd+J (ARR-020): each audio track's clips rendered into one recording, as they play, then one clip per track, one step of undo.
  const consolidateTime = useCallback(
    async (time: TimeSelection) => {
      const context = webAudio.getContext();
      if (!context) {
        return;
      }
      const notice = toast.loading("Consolidating…");
      try {
        const { rendered, made } = await renderConsolidated(
          context,
          doc,
          time,
          sources,
          new Set(recordings.keys())
        );
        if (canStore()) {
          await Promise.all(
            [...made].map(([id, { bytes }]) => saveRecording(id, bytes))
          );
        }
        setRecordings(
          (current) =>
            new Map([
              ...current,
              ...[...made].map(
                ([id, { recording }]) => [id, recording] as const
              ),
            ])
        );
        dispatch({ rendered, time, type: "consolidate-time" });
        toast.dismiss(notice);
      } catch (error) {
        toast.error(`Not consolidated: ${(error as Error).message}`, {
          id: notice,
        });
      }
    },
    [dispatch, doc, recordings, sources]
  );
  const timeSelection = useTimeSelection({
    bar,
    clips: doc.clips,
    copyOf: arrangement.copyOf,
    dispatch,
    getPosition: getCursor,
    onConsolidate: consolidateTime,
    selectedIds: arrangement.selectedIds,
    selectedTracks: pickedTracks,
    tracks: doc.tracks,
  });
  const selectedTime = timeSelection.time;
  // The locators and the time signatures, and what the keys do with the cursor.
  const getPosition = useCallback(() => position.getSnapshot(), [position]);
  const markers = useTimelineMarkers({
    dispatch,
    getPosition,
    onJump: seek,
    onPlay: playAt,
    step: grid.snapStep,
  });
  const pickNextTrack = useCallback(
    (id: string) => {
      dispatch({ additive: false, id, type: "select-track" });
      pickTrack(id);
    },
    [dispatch, pickTrack]
  );
  const cursorKeys = useTimelineCursor({
    clips: doc.clips,
    duration: doc.duration,
    getPosition,
    locators: doc.locators,
    onAddLocator: markers.addLocator,
    onPickTrack: pickNextTrack,
    onSeek: seek,
    selectedIds: arrangement.selectedIds,
    selectedTracks: pickedTracks,
    step: grid.step,
    tracks: doc.tracks,
  });
  /** Where the selected clips start and end, or null with none. */
  const clipsRange = useCallback((): [number, number] | null => {
    const chosen = doc.clips.filter((clip) =>
      arrangement.selectedIds.includes(clip.id)
    );
    return chosen.length > 0
      ? [
          Math.min(...chosen.map((clip) => clip.value.start)),
          Math.max(
            ...chosen.map((clip) => clip.value.start + clip.value.length)
          ),
        ]
      : null;
  }, [arrangement.selectedIds, doc.clips]);
  /** Z: the time selected fills the view, or the selected clips, or the loop when there is neither. */
  const zoomToSelection = useCallback(() => {
    view.zoomTo(...(selectedTime?.range ?? clipsRange() ?? doc.loop.range));
  }, [clipsRange, doc.loop.range, selectedTime, view]);
  /** Cmd+L with no time selected (the selection's own keys take it then): the loop around the selected clips, or on or off with none (TRN-007). */
  const loopKey = useCallback(() => {
    const range = clipsRange();
    dispatch({
      loop: range ? { on: true, range } : { on: !doc.loop.on },
      type: "set-loop",
    });
  }, [clipsRange, dispatch, doc.loop.on]);
  const setLooping = useCallback(
    (on: boolean) => dispatch({ loop: { on }, type: "set-loop" }),
    [dispatch]
  );
  const setTempo = useCallback(
    (tempo: Tempo) => dispatch({ tempo, type: "set-tempo" }),
    [dispatch]
  );

  // Files dropped on a track lay one after the other (ARR-005); on the add-track button, a track each (ARR-006).
  const [reading, setReading] = useState<readonly ReadingFiles[]>([]);
  const readingKey = useRef(0);
  const addFiles = useCallback(
    async (files: File[], track: string, at: number) => {
      const context = webAudio.getContext();
      if (!context) {
        return;
      }
      readingKey.current += 1;
      const key = readingKey.current;
      const [first] = files;
      const name =
        files.length === 1 && first ? nameOf(first) : `${files.length} files`;
      setReading((current) => [...current, { at, key, name, track }]);
      const { made, skipped } = await decodeFiles(
        context,
        files,
        new Set(recordings.keys()),
        canStream() ? streamRecording : undefined
      ).finally(() =>
        setReading((current) => current.filter((one) => one.key !== key))
      );
      if (skipped.length > 0) {
        toast.error(`Not a sound this browser can read: ${skipped.join(", ")}`);
      }
      if (made.size === 0) {
        return;
      }
      if (canStore()) {
        Promise.all(
          [...made].map(([id, { bytes }]) => saveRecording(id, bytes))
        ).catch(() =>
          setSaved("Not saved: the browser refused to store the file")
        );
      }
      const decoded = new Map(
        [...made].map(([id, { recording }]) => [id, recording])
      );
      setRecordings((current) => new Map([...current, ...decoded]));
      dispatch({
        commands: dropCommands(decoded, track, at, doc.duration, doc.tempo),
        type: "batch",
      });
    },
    [dispatch, doc.duration, doc.tempo, recordings]
  );

  // A recording dropped on a drum rack's pad (DEV-013): kept decoded, as a pad plays it whole and at once.
  const addPadSample = useCallback(
    async (track: string, rack: string, note: number, files: File[]) => {
      const context = webAudio.getContext();
      if (!context || files.length === 0) {
        return;
      }
      const { made, skipped } = await decodeFiles(
        context,
        files.slice(0, 1),
        new Set(recordings.keys())
      );
      if (skipped.length > 0) {
        toast.error(`Not a sound this browser can read: ${skipped.join(", ")}`);
      }
      const [first] = made;
      if (!first) {
        return;
      }
      const [id, { bytes, recording }] = first;
      if (canStore()) {
        saveRecording(id, bytes).catch(() =>
          setSaved("Not saved: the browser refused to store the file")
        );
      }
      setRecordings((current) => new Map([...current, [id, recording]]));
      dispatch({
        name: recording.name,
        note,
        rack,
        sound: {
          decay: Math.min(4, recording.length),
          kind: "sample",
          recording: id,
          tune: 0,
        },
        track,
        type: "set-pad",
      });
    },
    [dispatch, recordings]
  );

  // Export (EXP-001, EXP-002): the main output, from the start to the end of the last clip.
  // The project's folder on disk (PRJ-006, PRJ-007): Cmd+S saves to it, Cmd+Shift+S to another, Cmd+O opens one.
  const [folder, setFolder] = useState(initialFolder);
  const saveTo = useCallback(
    async (target: FileSystemDirectoryHandle) => {
      if (!(await mayWrite(target))) {
        toast.error(`The browser was not let write to ${target.name}.`);
        return;
      }
      // What the clips play, and the drum racks' pads.
      const played = new Set([
        ...doc.clips.map((clip) => clip.recording),
        ...padRecordings(allTracks(doc)),
      ]);
      const kept = [...recordings]
        .filter(([id]) => played.has(id))
        .map(([id, recording]) => ({ id, name: recording.name }));
      const notice = toast.loading(`Saving to ${target.name}…`);
      try {
        const { missing } = await saveToFolder(
          target,
          doc,
          kept,
          loadRecording
        );
        setFolder(target);
        await rememberFolder(target);
        if (missing.length > 0) {
          toast.warning(
            `Saved to ${target.name}, without ${missing.join(", ")}`,
            {
              id: notice,
            }
          );
        } else {
          toast.success(`Saved to ${target.name}`, { id: notice });
        }
      } catch (error) {
        toast.error(`Not saved: ${(error as Error).message}`, { id: notice });
      }
    },
    [doc, recordings]
  );
  const saveAs = useCallback(async () => {
    const picked = await pickFolder();
    if (picked) {
      await saveTo(picked);
    }
  }, [saveTo]);
  const save = useCallback(
    () => (folder ? saveTo(folder) : saveAs()),
    [folder, saveAs, saveTo]
  );
  const newSet = useCallback(
    () =>
      onOpen?.({
        folder: null,
        initial: newProject(),
        initialRecordings: new Map(),
      }),
    [onOpen]
  );
  const openProjectFolder = useCallback(async () => {
    const picked = await pickFolder();
    const context = webAudio.getContext();
    if (!(picked && context && onOpen)) {
      return;
    }
    const notice = toast.loading(`Opening ${picked.name}…`);
    try {
      const opened = await projectFromFolder(context, picked);
      await rememberFolder(picked);
      if (opened.missing.length > 0) {
        toast.warning(
          `Opened ${picked.name}, without ${opened.missing.join(", ")}`,
          {
            id: notice,
          }
        );
      } else {
        toast.success(`Opened ${picked.name}`, { id: notice });
      }
      onOpen({
        folder: picked,
        initial: opened.doc,
        initialRecordings: opened.recordings,
      });
    } catch (error) {
      toast.error((error as Error).message, { id: notice });
    }
  }, [onOpen]);

  // Projects of other DAWs, through DAWproject (PRJ-008).
  const exportDawproject = useCallback(async () => {
    const notice = toast.loading("Packing the project for other DAWs…");
    try {
      const { file, report } = await exportProject(doc, recordings);
      const name = `${folder?.name ?? "arrangement"}.dawproject`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      toast.success(`Exported to ${name}`, {
        description: lostLines(report),
        id: notice,
      });
    } catch (error) {
      toast.error(`Not exported: ${(error as Error).message}`, { id: notice });
    }
  }, [doc, folder, recordings]);
  const importInput = useRef<HTMLInputElement>(null);
  const importDawproject = useCallback(() => importInput.current?.click(), []);
  const openDawproject = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = event.target.files ?? [];
      event.target.value = "";
      const context = webAudio.getContext();
      if (!(file && context && onOpen)) {
        return;
      }
      const notice = toast.loading(`Opening ${file.name}…`);
      try {
        const opened = await importProject(context, file, TRACK_COLOR_COUNT);
        toast.success(`Opened ${file.name}`, {
          description: lostLines(opened.report),
          id: notice,
        });
        onOpen({
          folder: null,
          initial: opened.doc,
          initialRecordings: opened.recordings,
        });
      } catch (error) {
        toast.error((error as Error).message, { id: notice });
      }
    },
    [onOpen]
  );

  const exportWav = useCallback(async () => {
    // The time selected, or the whole arrangement to the end of its last clip (EXP-002).
    const [start, end] = selectedTime?.range ?? [
      0,
      Math.max(
        0,
        ...doc.clips.map((clip) => clip.value.start + clip.value.length)
      ),
    ];
    if (end <= 0) {
      toast.message("Nothing to export yet: drop an audio file on a track.");
      return;
    }
    setExporting(true);
    // The progress of the render, in a notice that says it is done once it is (EXP-008).
    const notice = toast.loading("Rendering the arrangement…");
    try {
      const context = webAudio.getContext();
      const rendered = await renderArrangement(doc, sources, {
        onProgress: (done) =>
          toast.loading(
            `Rendering the arrangement… ${Math.round(done * 100)}%`,
            {
              id: notice,
            }
          ),
        from: start,
        sampleRate: context?.sampleRate ?? 48_000,
        to: end,
      });
      if (rendered) {
        downloadWavFile(rendered, {
          bitDepth: 24,
          filename: "arrangement.wav",
        });
        toast.success("Exported to arrangement.wav", { id: notice });
      } else {
        toast.error("This browser cannot render offline.", { id: notice });
      }
    } finally {
      setExporting(false);
    }
  }, [doc, selectedTime, sources]);

  // A pad or a key played by hand, through the track's instrument (DEV-013).
  const noteOn = useCallback(
    (track: string, pitch: number, velocity: number) =>
      engine.engine?.noteOn(track, pitch, velocity),
    [engine.engine]
  );
  const noteOff = useCallback(
    (track: string, pitch: number) => engine.engine?.noteOff(track, pitch),
    [engine.engine]
  );
  const holdNote = useCallback(
    (track: string, note: Readonly<Record<string, number>> | null) =>
      engine.engine?.holdNote(track, note),
    [engine.engine]
  );

  // What each key does (KEY-001 and on), read when it is pressed.
  const commands: Partial<Record<ShortcutCommand, () => void>> = {
    automation: automation.toggle,
    detail: () => showView(shown === "clip" ? "devices" : "clip"),
    fold: () => {
      const picked = arrangement.selectedTracks;
      const chosen = picked.length > 0 ? picked : [selectedTrack ?? ""];
      for (const id of chosen) {
        arrangement.toggleFold(id);
      }
    },
    // The tracks picked go into a group (MIX-020), and a group picked lets its tracks go.
    group: () => {
      const picked = arrangement.selectedTracks;
      const chosen = picked.length > 0 ? picked : [selectedTrack ?? ""];
      dispatch({ ids: chosen, type: "group-tracks" });
    },
    "grid-finer": () => grid.change("finer"),
    "grid-fixed": () => grid.change("fixed"),
    "grid-snap": () => grid.change("snap"),
    "grid-triplet": () => grid.change("triplet"),
    "grid-wider": () => grid.change("wider"),
    loop: loopKey,
    library: () => setLibraryOpen((open) => !open),
    mixer: () => togglePanel("mixer"),
    // A group picked, or the group a picked track is in.
    ungroup: () => {
      const picked = arrangement.selectedTracks;
      const chosen = picked.length > 0 ? picked : [selectedTrack ?? ""];
      const groups = new Set(
        chosen.flatMap((id) => {
          const track = trackOf(doc, id);
          if (track?.kind === "group") {
            return [id];
          }
          return track?.group ? [track.group] : [];
        })
      );
      dispatch({
        commands: [...groups].map((id) => ({ id, type: "ungroup" as const })),
        type: "batch",
      });
    },
    "unfold-all": () => {
      for (const [id, on] of Object.entries(arrangement.folded)) {
        if (on) {
          arrangement.toggleFold(id);
        }
      }
    },
    "zoom-back": view.zoomBack,
    "zoom-in": () => view.zoomAround(position.getSnapshot(), 2),
    "zoom-out": () => view.zoomAround(position.getSnapshot(), 0.5),
    "zoom-selection": zoomToSelection,
    "audio-track": () => dispatch({ kind: "audio", type: "add-track" }),
    continue: () => playFrom(stoppedAt.current),
    deactivate: () => dispatch({ type: "toggle-selected" }),
    // Clips first; with none, the track its header picked: a press on a lane only puts the cursor there.
    delete: () => {
      const [track] = arrangement.selectedTracks;
      if (arrangement.selectedIds.length > 0) {
        dispatch({
          commands: arrangement.selectedIds.map((id) => ({
            id,
            type: "remove-clip" as const,
          })),
          type: "batch",
        });
      } else if (track) {
        dispatch({ id: track, type: "remove-track" });
      }
    },
    duplicate: () => {
      if (arrangement.selectedIds.length > 0) {
        dispatch({ type: "duplicate-selection" });
        return;
      }
      dispatch({
        commands: arrangement.selectedTracks.map((id) => ({
          id,
          type: "duplicate-track" as const,
        })),
        type: "batch",
      });
    },
    export: exportWav,
    ...(canUseFolders()
      ? { open: openProjectFolder, save, "save-as": saveAs }
      : {}),
    "midi-track": () => dispatch({ kind: "midi", type: "add-track" }),
    "play-stop": playPause,
    record: take.toggle,
    redo: () => dispatch({ type: "redo" }),
    "return-track": () => dispatch({ kind: "return", type: "add-track" }),
    "select-all": () => dispatch({ type: "select-all" }),
    solo: () => {
      if (selectedTrack) {
        dispatch({
          id: selectedTrack,
          patch: { soloed: true },
          type: "set-mix",
        });
      }
    },
    split: () => dispatch({ at: cursor, step: 0.01, type: "split-cursor" }),
    "to-start": () => seek(0),
    undo: () => dispatch({ type: "undo" }),
  };
  // One listener, before the focused control takes the key.
  const keys = useRef({
    commands,
    computerKeysOn,
    cursorKeys,
    timeSelection,
  });
  keys.current = { commands, computerKeysOn, cursorKeys, timeSelection };
  useEffect(() => {
    // What the workstation takes before its shortcuts: typing, the computer's keyboard, Escape, the time
    // selected and the cursor. A key taken here is not a shortcut too.
    const onKey = (event: KeyboardEvent) => {
      if (typing(event.target)) {
        TAKEN.add(event);
        return;
      }
      // The computer's keyboard plays notes: its keys are not shortcuts while it is on.
      if (
        keys.current.computerKeysOn &&
        !(event.metaKey || event.ctrlKey || event.altKey) &&
        isComputerKeyboardKey(event.code)
      ) {
        TAKEN.add(event);
        return;
      }
      // Escape lets go of what is selected, and stays the key of what it was pressed in.
      if (event.key === "Escape") {
        dispatch({ type: "clear-selection" });
        keys.current.timeSelection.clear();
        TAKEN.add(event);
        return;
      }
      // What a key does to the time selected, the clipboard and the cursor comes before what it does otherwise.
      const { cursorKeys: moves, timeSelection: time } = keys.current;
      if (
        time.handleKey(event) ||
        moves.handleKey(event) ||
        (onSurface(event.target) && moves.handleArrowKey(event))
      ) {
        TAKEN.add(event);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [dispatch]);
  // The shortcuts (docs/daw-spec/shortcuts.md): the app hotkeys, as the user may have rebound them, and their
  // second keys. Heard after what is taken above, once each: a key two chords match runs once.
  const appHotkeys = useAppHotkeys();
  const hotkeys = useMemo(() => {
    const run = (command: ShortcutCommand) => (event: KeyboardEvent) => {
      if (TAKEN.has(event)) {
        return;
      }
      TAKEN.add(event);
      event.preventDefault();
      keys.current.commands[command]?.();
    };
    return [
      ...Object.values(appHotkeys).map((hotkey) => ({
        callback: run(hotkey.id),
        hotkey,
      })),
      ...ALSO_HOTKEYS.map(({ command, hotkey }) => ({
        callback: run(command),
        hotkey,
      })),
    ];
  }, [appHotkeys]);
  useHotkeys(hotkeys, {
    // Heard on the way down, as the keys of the workstation are: a focused control can't keep one from it.
    capture: true,
    conflictBehavior: "allow",
    ignoreInputs: false,
    preventDefault: false,
    stopPropagation: false,
  });

  // Saved as you go (PRJ-001): the document, and which recordings it keeps.
  useEffect(() => {
    if (!canStore()) {
      return;
    }
    setSaved("Saving…");
    const timer = setTimeout(() => {
      saveProject({
        doc,
        recordings: [...recordings].map(([id, recording]) => ({
          id,
          name: recording.name,
        })),
        version: 1,
      })
        .then(() => setSaved("Saved"))
        .catch(() => setSaved("Not saved: the browser refused to store more"));
    }, SAVE_MS);
    return () => clearTimeout(timer);
  }, [doc, recordings]);

  const shownTrack = selectedTrack ? trackOf(doc, selectedTrack) : undefined;
  const sendRows = Math.ceil(doc.returns.length / SENDS_PER_ROW);
  const panelTitle = titleOf(shown, selectedClip, shownTrack);
  // What the panel holds, open: the clip view's own caret folds the panel to its bar.
  let content: ReactNode;
  if (shown === "mixer") {
    content = (
      <section aria-label="Mixer" className="h-full bg-muted/30">
        <MixerView
          armed={take.armed}
          arrangement={arrangement}
          engine={engine}
          onArm={armTrack}
          onMix={automation.changeMix}
          onSelectTrack={pickTrack}
          overridden={automation.overridden}
          selectedTrack={selectedTrack}
        />
      </section>
    );
  } else {
    content = (
      <section aria-label="Devices" className="h-full">
        {shown === "clip" && selectedClip ? (
          <ClipEditor
            actions={<PanelTabs clipAvailable />}
            arrangement={arrangement}
            clip={selectedClip}
            collapsed={false}
            engine={engine}
            folded={clipFolded}
            onCollapsedChange={foldPanel}
            onFoldedChange={setClipFolded}
            recordings={recordings}
          />
        ) : (
          <DeviceView
            arrangement={arrangement}
            onDeviceMoved={automation.deviceMoved}
            onHoldNote={holdNote}
            onNoteOff={noteOff}
            onNoteOn={noteOn}
            onOpenLibrary={openLibrary}
            onPadFiles={addPadSample}
            overridden={automation.overridden}
            position={engine.position}
            track={selectedTrack}
          />
        )}
      </section>
    );
  }

  return (
    <TooltipProvider>
      <input
        accept={DAWPROJECT_ACCEPT}
        aria-label="DAWproject file to open"
        className="hidden"
        onChange={openDawproject}
        ref={importInput}
        tabIndex={-1}
        type="file"
      />
      <div className="flex h-svh flex-col">
        <TopBar
          automating={automation.automating}
          canRedo={arrangement.canRedo}
          canUndo={arrangement.canUndo}
          exporting={exporting}
          looping={doc.loop.on}
          metronome={metronome}
          onAutomatingChange={automation.setAutomating}
          onExport={exportWav}
          onExportDawproject={exportDawproject}
          onImportDawproject={importDawproject}
          {...(canUseFolders()
            ? { onOpen: openProjectFolder, onSave: save, onSaveAs: saveAs }
            : {})}
          countIn={take.countIn}
          onCountInChange={take.setCountIn}
          onLoopingChange={setLooping}
          onMetronomeChange={setMetronome}
          onNew={newSet}
          onPlayPause={playPause}
          onPunchChange={take.setPunch}
          onRecordChange={take.toggle}
          onRedo={commands.redo}
          onReenableAutomation={
            automation.anyOverridden ? automation.reenable : undefined
          }
          onRhythmChange={setRhythm}
          onStop={stop}
          onTempoChange={setTempo}
          onUndo={commands.undo}
          onZoomRatioChange={view.setRatio}
          playing={engine.playing}
          position={transportPosition}
          punch={take.punch}
          recording={take.recording}
          recordSettings={
            <RecordSettings
              computerKeys={computerKeys}
              inputDevice={take.inputDevice}
              inputs={take.inputs}
              monitorInput={take.monitorInput}
              onComputerKeysChange={setComputerKeys}
              onInputDeviceChange={take.setInputDevice}
              onMonitorInputChange={take.setMonitorInput}
              onOverdubChange={take.setOverdub}
              onQuantizeChange={take.setQuantize}
              overdub={take.overdub}
              quantize={take.quantize}
            />
          }
          rhythm={rhythm}
          signatures={doc.signatures}
          tempo={doc.tempo}
          zoomMaxRatio={view.maxRatio}
          zoomRatio={view.ratio}
        />
        <div className="flex min-h-0 flex-1">
          <LibraryPanel
            onOpenChange={setLibraryOpen}
            onPick={pickDevice}
            open={libraryOpen}
            searchRef={librarySearch}
          />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* The arrangement over the mixer or the detail view, the line between them dragged to share the height. */}
            <ResizablePanelGroup
              className="min-h-0 flex-1"
              orientation="vertical"
            >
              <ResizablePanel
                className="flex flex-col"
                id="arrangement"
                minSize="8rem"
                style={UNSCROLLED}
              >
                <ArrangementView
                  armed={take.armed}
                  arrangement={arrangement}
                  automation={automation}
                  cursor={cursor}
                  engine={engine}
                  liveTake={take.live}
                  markers={markers}
                  onAddMidiClip={addMidiClip}
                  onArm={armTrack}
                  onDevice={dropDevice}
                  onEditClip={showClip}
                  onFiles={addFiles}
                  onSeek={seek}
                  onSelectTrack={pickTrack}
                  reading={reading}
                  recordings={recordings}
                  selectedTrack={selectedTrack}
                  timelineGrid={grid}
                  timelineZoom={view}
                  timeSelection={timeSelection}
                  viewportRef={viewportRef}
                />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel
                className="flex flex-col"
                collapsedSize={STRIP}
                collapsible
                defaultSize={
                  folded
                    ? STRIP
                    : `${heightOf(viewHeights.current[shown], shown, shownTrack?.devices, sendRows)}px`
                }
                groupResizeBehavior="preserve-pixel-size"
                id={shown}
                key={panelKey(shown, sendRows)}
                maxSize="70%"
                minSize={leastOf(shown, shownTrack?.devices, sendRows)}
                onResize={keepHeight}
                panelRef={panelRef}
                style={UNSCROLLED}
              >
                {/* One bar: the clip view's own strip carries the tabs while it shows a clip. */}
                <Tabs
                  className="h-full gap-0"
                  onValueChange={pickView}
                  value={shown}
                >
                  {folded || shown !== "clip" ? (
                    <PanelBar
                      clipAvailable={selectedClip !== undefined}
                      folded={folded}
                      onFoldedChange={foldPanel}
                      title={panelTitle}
                    />
                  ) : null}
                  {folded ? null : (
                    <TabsContent className="min-h-0" value={shown}>
                      {content}
                    </TabsContent>
                  )}
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
          </main>
        </div>
        <EngineLine saved={saved} status={engine.status} />
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
