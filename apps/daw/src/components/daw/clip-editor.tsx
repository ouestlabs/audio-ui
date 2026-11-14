import type { Note } from "@audio-ui/core/piano-roll";
import { secondsPerBar, secondsPerBeat } from "@audio-ui/engine/time";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import {
  ClipPanel,
  type ClipSettings,
  processedSettings,
} from "@/components/audio-ui/clip-panel";
import {
  MIDI_CLIP_VIEW,
  MidiClipPanel,
  type MidiClipRegion,
  type MidiClipView,
} from "@/components/audio-ui/midi-clip-panel";
import type { useArrangement } from "@/hooks/use-arrangement";
import type { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import {
  type Arranged,
  type ClipScale,
  type ClipSwing,
  DRUM_RACK_DEVICE,
} from "@/lib/arrangement";
import {
  type Processed,
  processSource,
  readSource,
  warmProcessing,
} from "@/lib/daw/process";
import { type Recording, sourcePeaks } from "@/lib/daw/recordings";
import {
  recordingBands,
  recordingChannels,
  recordingSamples,
} from "@/lib/daw/samples";
import {
  type SoundOperation,
  type SoundRange,
  soundOperationName,
} from "@/lib/sound-operations";
import { cn } from "@/lib/utils";
import { useSavedState } from "./use-saved-view";

type Arrangement = ReturnType<typeof useArrangement>;
type Engine = ReturnType<typeof useArrangementEngine>;

/** What the clip panel shows of an audio clip. */
function settingsOf(clip: Arranged): ClipSettings {
  return {
    gain: clip.gain ?? 0,
    length: clip.value.length,
    loop: clip.loop ?? null,
    offset: clip.value.offset,
    reversed: Boolean(clip.reversed),
    sourceLength: clip.sourceLength,
    transpose: clip.transpose ?? 0,
    warp: clip.warp ?? null,
    warpMode: clip.warpMode,
  };
}

/** The clip with the panel's settings, its fades kept inside it: past the end of the arrangement, the arrangement grows to hold it (TRN-008). */
function withSettings(clip: Arranged, next: ClipSettings): Arranged {
  const { length } = next;
  const fadeIn = Math.min(clip.value.fadeIn, length);
  return {
    ...clip,
    gain: next.gain,
    loop: next.loop ?? undefined,
    reversed: next.reversed,
    transpose: next.transpose,
    value: {
      ...clip.value,
      fadeIn,
      fadeOut: Math.min(clip.value.fadeOut, length - fadeIn),
      length,
      offset: next.offset,
    },
    warp: next.warp ?? undefined,
    warpMode: next.warpMode,
  };
}

/** Whether a clip still reads the stretch of the recording it read: the one an operation was run on. */
const sameSource = (clip: Arranged, was: Arranged) =>
  clip.recording === was.recording &&
  (clip.sourceFrom ?? 0) === (was.sourceFrom ?? 0) &&
  clip.sourceLength === was.sourceLength;

/** The clip reading the recording `id`, `length` long, an operation made of its source or of `range` of it: from its start, its times where `processedSettings` puts them. */
function withProcessed(
  clip: Arranged,
  { id, length }: { id: string; length: number },
  operation: SoundOperation,
  range: SoundRange | null
): Arranged {
  const { sourceFrom: _cut, ...rest } = withSettings(
    clip,
    processedSettings(settingsOf(clip), operation, length, range ?? undefined)
  );
  return { ...rest, recording: id, sourceLength: length };
}

/**
 * The clip view: the selected clip in its editor. A MIDI clip's notes in the
 * piano roll, whose keys play the track's instrument through the engine; an
 * audio clip's region, loop, warp, gain and reverse in the clip panel. Every
 * change is a command of the arrangement, a drag one step of undo. An
 * operation of its Process menu makes a recording of the clip's source,
 * handed to `onRecording` to keep, and the clip reads it: one step of undo.
 */
export function ClipEditor({
  actions,
  arrangement,
  clip,
  collapsed,
  engine,
  folded,
  onCollapsedChange,
  onFoldedChange,
  onRecording,
  recordings,
}: {
  /** What the clip view's strip carries at its end, such as the tabs of the panel it is in. */
  actions?: ReactNode;
  arrangement: Arrangement;
  clip: Arranged;
  /** Whether the panel is rolled up to its strip: the host's, so it stays so from clip to clip. */
  collapsed: boolean;
  engine: Engine;
  /** The boxes folded in the panel: the host's, so they stay folded from clip to clip. */
  folded: readonly string[];
  onCollapsedChange: (collapsed: boolean) => void;
  onFoldedChange: (folded: string[]) => void;
  /** A recording the Process menu or an edit made: keep it with the project's. */
  onRecording: (made: Processed) => Promise<void>;
  recordings: ReadonlyMap<string, Recording>;
}) {
  const { dispatch, doc } = arrangement;
  const [savedView, setSavedView] = useSavedState("midiView", MIDI_CLIP_VIEW);
  const [audioView, setAudioView] = useSavedState("audioView", "wave");
  // Each clip opens with the pen off, whatever the last one had: Draw is turned on for the clip it is wanted on.
  const [pen, setPen] = useState({ clip: clip.id, drawing: false });
  const midiView = {
    ...savedView,
    drawing: pen.clip === clip.id && pen.drawing,
  };
  const setMidiView = useCallback(
    ({ drawing, ...kept }: MidiClipView) => {
      setPen({ clip: clip.id, drawing });
      setSavedView({ ...kept, drawing: false });
    },
    [clip.id, setSavedView]
  );
  const bar = secondsPerBar(doc.tempo);
  // An audio clip's editor opened: the worker its edits run in is started now, so the first one does not wait for it.
  const audio = !clip.notes;
  useEffect(() => {
    if (audio) {
      warmProcessing();
    }
  }, [audio]);
  // Laid flat in the detail view, which draws the edge above it: no card of its own, and as tall as the view unless rolled up.
  const docked = cn("rounded-none border-0", !collapsed && "h-full");
  const edit = useCallback(
    (change: (current: Arranged) => Arranged) =>
      dispatch({ change, id: clip.id, type: "edit-clip" }),
    [clip.id, dispatch]
  );
  const settle = useCallback(
    () => dispatch({ type: "settle-clip-edit" }),
    [dispatch]
  );
  const rename = useCallback(
    (name: string) => dispatch({ id: clip.id, name, type: "rename-clip" }),
    [clip.id, dispatch]
  );
  const setActive = useCallback(
    (active: boolean) => {
      if (active === Boolean(clip.disabled)) {
        dispatch({
          action: "toggle",
          at: 0,
          id: clip.id,
          step: 0,
          type: "clip-action",
        });
      }
    },
    [clip.disabled, clip.id, dispatch]
  );
  const changeNotes = useCallback(
    (notes: Note[]) => edit((current) => ({ ...current, notes })),
    [edit]
  );
  const changeRegion = useCallback(
    (region: MidiClipRegion) =>
      edit((current) => ({
        ...current,
        loop: region.loop ?? undefined,
        sourceLength: region.sourceLength,
        value: {
          ...current.value,
          length: region.length,
          offset: region.offset,
        },
      })),
    [edit]
  );
  const changeSettings = useCallback(
    (next: ClipSettings) => edit((current) => withSettings(current, next)),
    [edit]
  );
  // Crop (CLP-029): the clip's source cut down to the stretch kept, the recording left as it is, and the clip on what is left of it.
  const crop = useCallback(
    (range: SoundRange, next: ClipSettings) => {
      edit((current) => ({
        ...withSettings(current, next),
        sourceFrom: (current.sourceFrom ?? 0) + range[0],
        sourceLength: next.sourceLength,
      }));
      settle();
    },
    [edit, settle]
  );
  // An edit or an operation of the Process menu (CLP-028, CLP-029): the clip's source, or the stretch of it selected, made into a recording of its own, then the clip reads it, one step of undo.
  const process = useCallback(
    async (operation: SoundOperation, range: SoundRange | null) => {
      const recording = clip.recording
        ? recordings.get(clip.recording)
        : undefined;
      if (!recording) {
        return;
      }
      const notice = toast.loading(`${soundOperationName(operation)}…`);
      try {
        const made = await processSource(
          recording,
          clip,
          operation,
          range,
          new Set(recordings.keys())
        );
        await onRecording(made);
        const { id, recording: kept } = made;
        const { length } = kept;
        dispatch({
          change: (current) =>
            sameSource(current, clip)
              ? withProcessed(current, { id, length }, operation, range)
              : current,
          id: clip.id,
          type: "edit-clip",
        });
        dispatch({ type: "settle-clip-edit" });
        toast.dismiss(notice);
      } catch (error) {
        toast.error(`Not processed: ${(error as Error).message}`, {
          id: notice,
        });
      }
    },
    [clip, dispatch, onRecording, recordings]
  );
  // What Copy and Cut keep (CLP-029): the samples of a stretch, pasted into this clip's source or another's.
  const [clipboard, setClipboard] = useState<Float32Array[] | null>(null);
  const copy = useCallback(
    async (range: SoundRange) => {
      const recording = clip.recording
        ? recordings.get(clip.recording)
        : undefined;
      if (recording) {
        setClipboard(await readSource(recording, clip, range));
      }
    },
    [clip, recordings]
  );
  const paste = useCallback(
    (range: SoundRange) => {
      if (clipboard) {
        process({ channels: clipboard, type: "paste" }, range);
      }
    },
    [clipboard, process]
  );
  // A drum clip's pads: those of the drum rack its track plays, lowest note on top, as a drum part is read.
  const drumRack = doc.tracks
    .find((track) => track.id === clip.track)
    ?.devices?.find((device) => device.device === DRUM_RACK_DEVICE)?.rack;
  const pads = useMemo(
    () =>
      drumRack?.chains
        .flatMap((chain) =>
          chain.pad ? [{ name: chain.name, note: chain.pad.note }] : []
        )
        .sort((a, b) => a.note - b.note),
    [drumRack]
  );
  const changeSwing = useCallback(
    (swing: ClipSwing | null) =>
      edit(({ swing: _was, ...current }) =>
        swing ? { ...current, swing } : current
      ),
    [edit]
  );
  const changeScale = useCallback(
    (scale: ClipScale) => edit((current) => ({ ...current, scale })),
    [edit]
  );
  // The key is read from every MIDI clip of the song but its drums: one part alone is often ambiguous.
  const keyNotes = useMemo(() => {
    const drumTracks = new Set(
      doc.tracks
        .filter((track) =>
          track.devices?.some((device) => device.device === DRUM_RACK_DEVICE)
        )
        .map((track) => track.id)
    );
    return doc.clips.flatMap((each) =>
      each.notes && !drumTracks.has(each.track) && !each.disabled
        ? each.notes
        : []
    );
  }, [doc.clips, doc.tracks]);
  // The sound of the song's audio clips too: each recording's chroma, moved by the clip's transposition, for as long as it plays.
  const keyAudio = useMemo(() => {
    const sum = new Array<number>(12).fill(0);
    for (const each of doc.clips) {
      const chroma = each.recording
        ? recordings.get(each.recording)?.chroma
        : undefined;
      if (!chroma || each.disabled) {
        continue;
      }
      const shift = Math.round(each.transpose ?? 0);
      for (const [pitchClass, share] of chroma.entries()) {
        const at = (((pitchClass + shift) % 12) + 12) % 12;
        sum[at] = (sum[at] as number) + share * each.value.length;
      }
    }
    return sum;
  }, [doc.clips, recordings]);
  // A pad's name pressed in the steps: the track plays it, let go at once, as a drum rings on.
  const auditionPad = useCallback(
    (note: number) => {
      engine.engine?.noteOn(clip.track, note, 0.8);
      engine.engine?.noteOff(clip.track, note);
    },
    [clip.track, engine.engine]
  );
  // A key pressed in the piano roll plays the track's instrument.
  const noteOn = useCallback(
    (pitch: number, details: { velocity: number }) =>
      engine.engine?.noteOn(clip.track, pitch, details.velocity),
    [clip.track, engine.engine]
  );
  const noteOff = useCallback(
    (pitch: number) => engine.engine?.noteOff(clip.track, pitch),
    [clip.track, engine.engine]
  );

  if (clip.notes) {
    return (
      <MidiClipPanel
        active={!clip.disabled}
        bar={bar}
        beat={secondsPerBeat(doc.tempo)}
        className={docked}
        collapsed={collapsed}
        foldedBoxes={folded}
        key={clip.id}
        keyAudio={keyAudio}
        keyNotes={keyNotes}
        name={clip.name}
        notes={clip.notes}
        onActiveChange={setActive}
        onCollapsedChange={onCollapsedChange}
        onFoldedBoxesChange={onFoldedChange}
        onNoteOff={noteOff}
        onNoteOn={noteOn}
        onNotesChange={changeNotes}
        onNotesCommitted={settle}
        onPadOn={auditionPad}
        onRegionChange={changeRegion}
        onRename={rename}
        onScaleChange={pads ? undefined : changeScale}
        onSwingChange={changeSwing}
        onViewChange={setMidiView}
        pads={pads}
        position={engine.position}
        region={{
          length: clip.value.length,
          loop: clip.loop ?? null,
          offset: clip.value.offset,
          sourceLength: clip.sourceLength,
        }}
        scale={clip.scale}
        start={clip.value.start}
        swing={clip.swing}
        view={midiView}
      >
        {actions}
      </MidiClipPanel>
    );
  }
  const recording = clip.recording ? recordings.get(clip.recording) : undefined;
  return (
    <ClipPanel
      active={!clip.disabled}
      bands={recording ? recordingBands(recording.source) : undefined}
      bar={bar}
      beatsPerBar={doc.tempo.beatsPerBar}
      canPaste={clipboard !== null}
      channels={recording ? recordingChannels(recording.source) : undefined}
      className={docked}
      collapsed={collapsed}
      foldedBoxes={folded}
      key={clip.id}
      name={clip.name}
      onActiveChange={setActive}
      onCollapsedChange={onCollapsedChange}
      onCopy={copy}
      onCrop={crop}
      onFoldedBoxesChange={onFoldedChange}
      onPaste={paste}
      onProcess={recording ? process : undefined}
      onRename={rename}
      onValueChange={changeSettings}
      onValueCommitted={settle}
      onViewChange={setAudioView}
      position={engine.position}
      sampleRate={recording?.source.sampleRate}
      samples={recording ? recordingSamples(recording.source) : undefined}
      sourceFrom={clip.sourceFrom}
      start={clip.value.start}
      value={settingsOf(clip)}
      values={recording ? sourcePeaks(clip, recording) : []}
      view={audioView}
    >
      {actions}
    </ClipPanel>
  );
}
