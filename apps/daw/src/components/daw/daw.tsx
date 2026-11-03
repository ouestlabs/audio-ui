import { secondsPerBar, type Tempo } from "@audio-ui/core/time";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { ArrangementView } from "@/components/daw/arrangement-view";
import { ClipEditor } from "@/components/daw/clip-editor";
import { DeviceView } from "@/components/daw/device-view";
import { EngineLine } from "@/components/daw/engine-line";
import { LibraryPanel } from "@/components/daw/library-panel";
import { MixerView } from "@/components/daw/mixer-view";
import { TopBar } from "@/components/daw/top-bar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useArrangement } from "@/hooks/use-arrangement";
import { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import { useTimelineGrid } from "@/hooks/use-timeline-grid";
import { useTimelineZoom } from "@/hooks/use-timeline-zoom";
import { renderArrangement } from "@/lib/arrangement-engine";
import type { ArrangementDoc } from "@/lib/arrangement-state";
import { addDeviceCommand, takesDevice } from "@/lib/daw/devices";
import { decodeFiles, dropCommands, NEW_TRACK } from "@/lib/daw/drop";
import { TRACK_COLOR_COUNT } from "@/lib/daw/project";
import { freshMidiClipId, type Recording } from "@/lib/daw/recordings";
import { matchShortcut, type ShortcutCommand } from "@/lib/daw/shortcuts";
import { canStore, saveProject, saveRecording } from "@/lib/daw/storage";
import { libraryDevice } from "@/lib/device-library";
import { downloadWavFile } from "@/lib/wav-file";
import { webAudio } from "@/lib/web-audio";

/** How long after a change the project is saved (PRJ-001: within a second). */
const SAVE_MS = 500;

const FIELDS = /^(INPUT|TEXTAREA|SELECT)$/;

/** Whether a key press goes to a field being typed in rather than to the app. */
function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || FIELDS.test(target.tagName))
  );
}

export interface DawProps {
  initial: ArrangementDoc;
  initialRecordings: ReadonlyMap<string, Recording>;
}

/**
 * The workstation: the document of the arrangement (`useArrangement`), the
 * recordings it plays, and the engine that plays it (`useArrangementEngine`),
 * with the arrangement, the devices of the selected track, the mixer, the
 * transport and the engine line around them. It holds the start marker and
 * the keyboard; everything else is the registry's.
 */
export function Daw({ initial, initialRecordings }: DawProps) {
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
  const engine = useArrangementEngine({ doc, recordings: sources });
  const [cursor, setCursor] = useState(0);
  const stoppedAt = useRef(0);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(
    initial.tracks[0]?.id ?? null
  );
  // Under the arrangement, the detail view or the mixer, one at a time: both would leave the tracks no room.
  const [panel, setPanel] = useState<"detail" | "mixer" | null>("detail");
  const mixerOpen = panel === "mixer";
  const detailOpen = panel === "detail";
  // How tall each is, in px: a height dragged is kept for the next time it opens.
  const panelHeights = useRef({ detail: 288, mixer: 416 });
  const keepHeight = useCallback(
    (size: { inPixels: number }) => {
      if (panel) {
        panelHeights.current[panel] = size.inPixels;
      }
    },
    [panel]
  );
  // The clip panel rolled up and its boxes folded, held here so they stay from clip to clip.
  const [clipRolled, setClipRolled] = useState(false);
  const [clipFolded, setClipFolded] = useState<string[]>([]);
  const setMixerOpen = useCallback(
    (open: boolean) =>
      setPanel((current) => {
        if (open) {
          return "mixer";
        }
        return current === "mixer" ? null : current;
      }),
    []
  );
  const setDetailOpen = useCallback(
    (open: boolean) =>
      setPanel((current) => {
        if (open) {
          return "detail";
        }
        return current === "detail" ? null : current;
      }),
    []
  );
  // What the detail view shows: the selected clip, or the selected track's devices (KEY-022).
  const [detail, setDetail] = useState<"clip" | "devices">("devices");
  const [single] =
    arrangement.selectedIds.length === 1 ? arrangement.selectedIds : [];
  const selectedClip = single
    ? doc.clips.find((clip) => clip.id === single)
    : undefined;
  // Picking a clip shows it; picking a track shows its devices.
  useEffect(() => {
    if (single) {
      setDetail("clip");
    }
  }, [single]);
  const pickTrack = useCallback((id: string) => {
    setSelectedTrack(id);
    setDetail("devices");
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
        pickTrack(made.track);
        setDetailOpen(true);
      }
    },
    [dispatch, doc, pickTrack, setDetailOpen]
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
      setDetailOpen(true);
    },
    [dispatch, doc.clips, doc.tempo, setDetailOpen]
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
  /** Z: the selected clips fill the view, or the loop when none is. */
  const zoomToSelection = useCallback(() => {
    const chosen = doc.clips.filter((clip) =>
      arrangement.selectedIds.includes(clip.id)
    );
    if (chosen.length === 0) {
      view.zoomTo(...doc.loop.range);
      return;
    }
    view.zoomTo(
      Math.min(...chosen.map((clip) => clip.value.start)),
      Math.max(...chosen.map((clip) => clip.value.start + clip.value.length))
    );
  }, [arrangement.selectedIds, doc.clips, doc.loop.range, view]);
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
        new Set(recordings.keys())
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
  const exportWav = useCallback(async () => {
    const end = Math.max(
      0,
      ...doc.clips.map((clip) => clip.value.start + clip.value.length)
    );
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
  }, [doc, sources]);

  // The view's keys: the grid, and the zoom around the playhead, onto the selection and back.
  const viewKeys: Partial<Record<ShortcutCommand, () => void>> = {
    "grid-finer": () => grid.change("finer"),
    "grid-fixed": () => grid.change("fixed"),
    "grid-snap": () => grid.change("snap"),
    "grid-triplet": () => grid.change("triplet"),
    "grid-wider": () => grid.change("wider"),
    "zoom-back": view.zoomBack,
    "zoom-in": () => view.zoomAround(position.getSnapshot(), 2),
    "zoom-out": () => view.zoomAround(position.getSnapshot(), 0.5),
    "zoom-selection": zoomToSelection,
  };
  // The keyboard (KEY-001 and on): one listener, before the focused control takes the key.
  const keys = useRef({ cursor, playPause, selectedTrack, viewKeys });
  keys.current = { cursor, playPause, selectedTrack, viewKeys };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typing(event.target)) {
        return;
      }
      const command = matchShortcut(event);
      if (!command) {
        return;
      }
      event.preventDefault();
      const {
        cursor: at,
        playPause: toggle,
        selectedTrack: picked,
        viewKeys: forView,
      } = keys.current;
      switch (command) {
        case "play-stop":
          toggle();
          break;
        case "continue":
          playFrom(stoppedAt.current);
          break;
        case "to-start":
          seek(0);
          break;
        case "loop":
          dispatch({
            loop: { on: !arrangement.doc.loop.on },
            type: "set-loop",
          });
          break;
        case "undo":
          dispatch({ type: "undo" });
          break;
        case "redo":
          dispatch({ type: "redo" });
          break;
        case "audio-track":
          dispatch({ kind: "audio", type: "add-track" });
          break;
        case "midi-track":
          dispatch({ kind: "midi", type: "add-track" });
          break;
        case "return-track":
          dispatch({ kind: "return", type: "add-track" });
          break;
        case "delete":
          for (const id of arrangement.selectedIds) {
            dispatch({ id, type: "remove-clip" });
          }
          break;
        case "split":
          dispatch({ at, step: 0.01, type: "split-cursor" });
          break;
        case "duplicate":
          dispatch({ type: "duplicate-selection" });
          break;
        case "deactivate":
          dispatch({ type: "toggle-selected" });
          break;
        case "solo":
          if (picked) {
            dispatch({ id: picked, patch: { soloed: true }, type: "set-mix" });
          }
          break;
        case "select-all":
          dispatch({ type: "select-all" });
          break;
        case "mixer":
          setPanel((current) => (current === "mixer" ? null : "mixer"));
          break;
        case "library":
          setLibraryOpen((open) => !open);
          break;
        case "detail":
          setDetail((shown) => (shown === "clip" ? "devices" : "clip"));
          setDetailOpen(true);
          break;
        case "export":
          exportWav();
          break;
        default:
          forView[command]?.();
          break;
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [
    arrangement.doc.loop.on,
    arrangement.selectedIds,
    dispatch,
    exportWav,
    playFrom,
    seek,
    setDetailOpen,
  ]);

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

  const clipEditor =
    detailOpen && detail === "clip" && selectedClip ? (
      <ClipEditor
        arrangement={arrangement}
        clip={selectedClip}
        collapsed={clipRolled}
        engine={engine}
        folded={clipFolded}
        onCollapsedChange={setClipRolled}
        onFoldedChange={setClipFolded}
        recordings={recordings}
      />
    ) : null;
  const rolledUp = clipEditor !== null && clipRolled;

  return (
    <TooltipProvider>
      <div className="flex h-svh flex-col">
        <TopBar
          detailOpen={detailOpen}
          exporting={exporting}
          looping={doc.loop.on}
          mixerOpen={mixerOpen}
          onDetailOpenChange={setDetailOpen}
          onExport={exportWav}
          onLoopingChange={setLooping}
          onMixerOpenChange={setMixerOpen}
          onPlayPause={playPause}
          onStop={stop}
          onTempoChange={setTempo}
          playing={engine.playing}
          position={engine.position}
          tempo={doc.tempo}
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
              >
                <ArrangementView
                  arrangement={arrangement}
                  cursor={cursor}
                  engine={engine}
                  onAddMidiClip={addMidiClip}
                  onDevice={dropDevice}
                  onFiles={addFiles}
                  onSeek={seek}
                  onSelectTrack={pickTrack}
                  recordings={recordings}
                  selectedTrack={selectedTrack}
                  timelineGrid={grid}
                  timelineZoom={view}
                  viewportRef={viewportRef}
                />
              </ResizablePanel>
              {panel && !rolledUp ? (
                <>
                  <ResizableHandle />
                  <ResizablePanel
                    defaultSize={`${panelHeights.current[panel]}px`}
                    groupResizeBehavior="preserve-pixel-size"
                    id={panel}
                    key={panel}
                    maxSize="85%"
                    minSize="9rem"
                    onResize={keepHeight}
                  >
                    {mixerOpen ? (
                      <section
                        aria-label="Mixer"
                        className="h-full bg-muted/30"
                      >
                        <MixerView
                          arrangement={arrangement}
                          engine={engine}
                          onSelectTrack={pickTrack}
                          selectedTrack={selectedTrack}
                        />
                      </section>
                    ) : (
                      <section aria-label="Devices" className="h-full">
                        {clipEditor ?? (
                          <DeviceView
                            arrangement={arrangement}
                            onOpenLibrary={openLibrary}
                            track={selectedTrack}
                          />
                        )}
                      </section>
                    )}
                  </ResizablePanel>
                </>
              ) : null}
            </ResizablePanelGroup>
            {/* Rolled up, the clip panel is its strip alone: nothing to drag. */}
            {rolledUp ? (
              <section aria-label="Devices" className="shrink-0 border-t">
                {clipEditor}
              </section>
            ) : null}
          </main>
        </div>
        <EngineLine saved={saved} status={engine.status} />
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
