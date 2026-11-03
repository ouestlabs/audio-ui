import { secondsPerBar, type Tempo } from "@audio-ui/core/time";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrangementView } from "@/components/daw/arrangement-view";
import { ClipEditor } from "@/components/daw/clip-editor";
import { DeviceView } from "@/components/daw/device-view";
import { EngineLine } from "@/components/daw/engine-line";
import { MixerView } from "@/components/daw/mixer-view";
import { TopBar } from "@/components/daw/top-bar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useArrangement } from "@/hooks/use-arrangement";
import { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import { renderArrangement } from "@/lib/arrangement-engine";
import type { ArrangementDoc } from "@/lib/arrangement-state";
import { decodeFiles, dropCommands } from "@/lib/daw/drop";
import { TRACK_COLOR_COUNT } from "@/lib/daw/project";
import { freshMidiClipId, type Recording } from "@/lib/daw/recordings";
import { matchShortcut } from "@/lib/daw/shortcuts";
import { canStore, saveProject, saveRecording } from "@/lib/daw/storage";
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
  const [mixerOpen, setMixerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
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
    [dispatch, doc.clips, doc.tempo]
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

  // The keyboard (KEY-001 and on): one listener, before the focused control takes the key.
  const keys = useRef({ cursor, playPause, selectedTrack });
  keys.current = { cursor, playPause, selectedTrack };
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
          setMixerOpen((open) => !open);
          break;
        case "detail":
          setDetail((shown) => (shown === "clip" ? "devices" : "clip"));
          setDetailOpen(true);
          break;
        case "export":
          exportWav();
          break;
        default:
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
        <main className="flex min-h-0 flex-1 flex-col">
          <ArrangementView
            arrangement={arrangement}
            cursor={cursor}
            engine={engine}
            onAddMidiClip={addMidiClip}
            onFiles={addFiles}
            onSeek={seek}
            onSelectTrack={pickTrack}
            recordings={recordings}
            selectedTrack={selectedTrack}
          />
          {mixerOpen ? (
            <section
              aria-label="Mixer"
              className="h-[26rem] shrink-0 border-t bg-muted/30"
            >
              <MixerView
                arrangement={arrangement}
                engine={engine}
                onSelectTrack={pickTrack}
                selectedTrack={selectedTrack}
              />
            </section>
          ) : null}
          {detailOpen ? (
            <section aria-label="Devices" className="h-72 shrink-0 border-t">
              {detail === "clip" && selectedClip ? (
                <ClipEditor
                  arrangement={arrangement}
                  clip={selectedClip}
                  engine={engine}
                  recordings={recordings}
                />
              ) : (
                <DeviceView arrangement={arrangement} track={selectedTrack} />
              )}
            </section>
          ) : null}
        </main>
        <EngineLine saved={saved} status={engine.status} />
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
