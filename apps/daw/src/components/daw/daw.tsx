import {
  type MetronomeRhythm,
  secondsPerBar,
  type Tempo,
} from "@audio-ui/core/time";
import {
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
import { ArrangementView } from "@/components/daw/arrangement-view";
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
import type { Arranged, ArrangementTrack } from "@/lib/arrangement";
import { renderArrangement } from "@/lib/arrangement-engine";
import { type ArrangementDoc, trackOf } from "@/lib/arrangement-state";
import { canStream, streamRecording } from "@/lib/daw/cache";
import { addDeviceCommand, takesDevice } from "@/lib/daw/devices";
import { decodeFiles, dropCommands, NEW_TRACK } from "@/lib/daw/drop";
import {
  canUseFolders,
  mayWrite,
  pickFolder,
  rememberFolder,
  saveToFolder,
} from "@/lib/daw/folder";
import { projectFromFolder } from "@/lib/daw/open-folder";
import { TRACK_COLOR_COUNT } from "@/lib/daw/project";
import { freshMidiClipId, type Recording } from "@/lib/daw/recordings";
import { matchShortcut, type ShortcutCommand } from "@/lib/daw/shortcuts";
import {
  canStore,
  loadRecording,
  saveProject,
  saveRecording,
} from "@/lib/daw/storage";
import { libraryDevice } from "@/lib/device-library";
import { downloadWavFile } from "@/lib/wav-file";
import { webAudio } from "@/lib/web-audio";

/** Neither panel scrolls: the timeline and the views scroll inside themselves, and a size rounded under the bar's height shows no scrollbar. The library styles a panel's inner div to scroll, and its `style` comes after. */
const UNSCROLLED = { overflow: "hidden" } as const;

/** The panel under the arrangement folded: its strip alone. */
const STRIP = "2.25rem";
/** The least height of each view of that panel, its strip included: under it, what it shows is cut off. */
const LEAST: Record<PanelView, string> = {
  clip: "15rem",
  devices: "25rem",
  mixer: "26rem",
};

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
  const [metronome, setMetronome] = useState(false);
  const [rhythm, setRhythm] = useState<MetronomeRhythm>("auto");
  const engine = useArrangementEngine({
    doc,
    metronome: { on: metronome, rhythm },
    overridden: automation.overridden,
    recordings: sources,
  });
  const [cursor, setCursor] = useState(0);
  const stoppedAt = useRef(0);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(
    initial.tracks[0]?.id ?? null
  );
  // Under the arrangement, one panel (MIX-015): the selected clip, the selected track's devices, or the mixer. Like
  // the library, it is always there, folded to its strip or open, its height shared with the tracks by the line above.
  const [panelView, setPanelView] = useState<PanelView>("devices");
  const [folded, setFolded] = useState(false);
  const panelRef = usePanelRef();
  const [single] =
    arrangement.selectedIds.length === 1 ? arrangement.selectedIds : [];
  const selectedClip = single
    ? doc.clips.find((clip) => clip.id === single)
    : undefined;
  // The clip view shows the selected clip: with none, the devices.
  const shown = panelView === "clip" && !selectedClip ? "devices" : panelView;
  // How tall each view is, in px: a height dragged is kept for the next time it shows.
  const viewHeights = useRef<Record<PanelView, number>>({
    clip: 288,
    devices: 400,
    mixer: 416,
  });
  // Folded by the line dragged under the view's least height, or opened by dragging it up.
  const keepHeight = useCallback(
    (size: { inPixels: number }, id: string | number | undefined) => {
      // A panel reports under its own id: the view it was, even as another takes its place.
      if (id !== shown) {
        return;
      }
      const collapsed = panelRef.current?.isCollapsed() ?? false;
      setFolded(collapsed);
      if (!collapsed) {
        viewHeights.current[shown] = size.inPixels;
      }
    },
    [panelRef, shown]
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
    [panelRef, shown]
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
    [foldPanel, shown]
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
  const [clipFolded, setClipFolded] = useState<string[]>([]);
  // Picking a clip shows it, picking a track its devices, the mixer left where it is.
  useEffect(() => {
    if (single) {
      setPanelView((current) => (current === "mixer" ? current : "clip"));
    }
  }, [single]);
  const pickTrack = useCallback((id: string) => {
    setSelectedTrack(id);
    setPanelView((current) => (current === "mixer" ? current : "devices"));
  }, []);
  // The library on the left (KEY-021), and its search, which the end of a chain focuses.
  const [libraryOpen, setLibraryOpen] = useState(true);
  const librarySearch = useRef<HTMLInputElement>(null);
  const openLibrary = useCallback(() => {
    setLibraryOpen(true);
    requestAnimationFrame(() => librarySearch.current?.focus());
  }, []);
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
    [dispatch, doc, showView]
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
    if (engine.playing) {
      stoppedAt.current = engine.engine?.position() ?? cursor;
      engine.stop();
      engine.position.set(cursor);
    } else {
      // Stop pressed while stopped goes back to the start (TRN-003).
      setCursor(0);
      engine.position.set(0);
    }
  }, [cursor, engine]);
  const playPause = useCallback(
    () => (engine.playing ? stop() : playFrom(cursor)),
    [cursor, engine.playing, playFrom, stop]
  );
  // Stop then comes back here (ARR-016).
  const playAt = useCallback(
    (seconds: number) => {
      setCursor(seconds);
      playFrom(seconds);
    },
    [playFrom]
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
    [engine, playFrom]
  );
  // The arrangement's zoom and grid, which the keys change too (KEY-016 to KEY-018).
  const viewportRef = useRef<HTMLDivElement>(null);
  const view = useTimelineZoom({ duration: doc.duration, viewportRef });
  const grid = useTimelineGrid({ tempo: doc.tempo, zoom: view.zoom });
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
  }, [bar, position, rescale, running]);
  // A stretch of time on some tracks, dragged across bare lanes, and what the keys do with it.
  const getCursor = useCallback(() => cursor, [cursor]);
  // The tracks the keys work on: those picked by their headers, or the one last pressed.
  const pickedTracks = useMemo(() => {
    if (arrangement.selectedTracks.length > 0) {
      return arrangement.selectedTracks;
    }
    return selectedTrack ? [selectedTrack] : [];
  }, [arrangement.selectedTracks, selectedTrack]);
  const timeSelection = useTimeSelection({
    bar,
    clips: doc.clips,
    copyOf: arrangement.copyOf,
    dispatch,
    getPosition: getCursor,
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

  // Files dropped on a track lay one after the other (ARR-005); on the add-track row, a track each (ARR-006).
  const addFiles = useCallback(
    async (files: File[], track: string, at: number) => {
      const context = webAudio.getContext();
      if (!context) {
        return;
      }
      const { made, skipped } = await decodeFiles(
        context,
        files,
        new Set(recordings.keys()),
        canStream() ? streamRecording : undefined
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
        commands: dropCommands(decoded, track, at, doc.duration),
        type: "batch",
      });
    },
    [dispatch, doc.duration, recordings]
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
      const played = new Set(doc.clips.map((clip) => clip.recording));
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
    "grid-finer": () => grid.change("finer"),
    "grid-fixed": () => grid.change("fixed"),
    "grid-snap": () => grid.change("snap"),
    "grid-triplet": () => grid.change("triplet"),
    "grid-wider": () => grid.change("wider"),
    loop: loopKey,
    library: () => setLibraryOpen((open) => !open),
    mixer: () => togglePanel("mixer"),
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
  const keys = useRef({ commands, cursorKeys, timeSelection });
  keys.current = { commands, cursorKeys, timeSelection };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typing(event.target)) {
        return;
      }
      // Escape lets go of what is selected, and stays the key of what it was pressed in.
      if (event.key === "Escape") {
        dispatch({ type: "clear-selection" });
        keys.current.timeSelection.clear();
        return;
      }
      // What a key does to the time selected, the clipboard and the cursor comes before what it does otherwise.
      const { cursorKeys: moves, timeSelection: time } = keys.current;
      if (
        time.handleKey(event) ||
        moves.handleKey(event) ||
        (onSurface(event.target) && moves.handleArrowKey(event))
      ) {
        return;
      }
      const command = matchShortcut(event);
      if (command) {
        event.preventDefault();
        keys.current.commands[command]?.();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [dispatch]);

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

  const panelTitle = titleOf(
    shown,
    selectedClip,
    selectedTrack ? trackOf(doc, selectedTrack) : undefined
  );
  // What the panel holds, open: the clip view's own caret folds the panel to its bar.
  let content: ReactNode;
  if (shown === "mixer") {
    content = (
      <section aria-label="Mixer" className="h-full bg-muted/30">
        <MixerView
          arrangement={arrangement}
          engine={engine}
          onMix={automation.changeMix}
          onSelectTrack={pickTrack}
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
            onOpenLibrary={openLibrary}
            track={selectedTrack}
          />
        )}
      </section>
    );
  }

  return (
    <TooltipProvider>
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
          {...(canUseFolders()
            ? { onOpen: openProjectFolder, onSave: save, onSaveAs: saveAs }
            : {})}
          onLoopingChange={setLooping}
          onMetronomeChange={setMetronome}
          onPlayPause={playPause}
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
          position={engine.position}
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
                  arrangement={arrangement}
                  automation={automation}
                  cursor={cursor}
                  engine={engine}
                  markers={markers}
                  onAddMidiClip={addMidiClip}
                  onDevice={dropDevice}
                  onEditClip={showClip}
                  onFiles={addFiles}
                  onSeek={seek}
                  onSelectTrack={pickTrack}
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
                defaultSize={folded ? STRIP : `${viewHeights.current[shown]}px`}
                groupResizeBehavior="preserve-pixel-size"
                id={shown}
                key={shown}
                maxSize="70%"
                minSize={LEAST[shown]}
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
