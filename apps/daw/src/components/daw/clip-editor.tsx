import type { Note } from "@audio-ui/core/piano-roll";
import { secondsPerBar, secondsPerBeat } from "@audio-ui/core/time";
import { type ReactNode, useCallback, useState } from "react";
import { ClipPanel, type ClipSettings } from "@/components/audio-ui/clip-panel";
import {
  MIDI_CLIP_VIEW,
  MidiClipPanel,
  type MidiClipRegion,
  type MidiClipView,
} from "@/components/audio-ui/midi-clip-panel";
import type { useArrangement } from "@/hooks/use-arrangement";
import type { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import type { Arranged } from "@/lib/arrangement";
import { type Recording, sourcePeaks } from "@/lib/daw/recordings";
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

/** The clip with the panel's settings, ending where the timeline does at most, its fades kept inside it. */
function withSettings(
  clip: Arranged,
  next: ClipSettings,
  duration: number
): Arranged {
  const length = Math.min(next.length, duration - clip.value.start);
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

/**
 * The clip view: the selected clip in its editor. A MIDI clip's notes in the
 * piano roll, whose keys play the track's instrument through the engine; an
 * audio clip's region, loop, warp, gain and reverse in the clip panel. Every
 * change is a command of the arrangement, a drag one step of undo.
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
  recordings: ReadonlyMap<string, Recording>;
}) {
  const { dispatch, doc } = arrangement;
  const [savedView, setSavedView] = useSavedState("midiView", MIDI_CLIP_VIEW);
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
          length: Math.min(region.length, doc.duration - current.value.start),
          offset: region.offset,
        },
      })),
    [doc.duration, edit]
  );
  const changeSettings = useCallback(
    (next: ClipSettings) =>
      edit((current) => withSettings(current, next, doc.duration)),
    [doc.duration, edit]
  );
  const crop = useCallback(
    () => dispatch({ id: clip.id, type: "crop-clip" }),
    [clip.id, dispatch]
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
        name={clip.name}
        notes={clip.notes}
        onActiveChange={setActive}
        onCollapsedChange={onCollapsedChange}
        onFoldedBoxesChange={onFoldedChange}
        onNoteOff={noteOff}
        onNoteOn={noteOn}
        onNotesChange={changeNotes}
        onNotesCommitted={settle}
        onRegionChange={changeRegion}
        onRename={rename}
        onViewChange={setMidiView}
        region={{
          length: clip.value.length,
          loop: clip.loop ?? null,
          offset: clip.value.offset,
          sourceLength: clip.sourceLength,
        }}
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
      bar={bar}
      beatsPerBar={doc.tempo.beatsPerBar}
      className={docked}
      collapsed={collapsed}
      foldedBoxes={folded}
      key={clip.id}
      name={clip.name}
      onActiveChange={setActive}
      onCollapsedChange={onCollapsedChange}
      onCrop={crop}
      onFoldedBoxesChange={onFoldedChange}
      onRename={rename}
      onValueChange={changeSettings}
      onValueCommitted={settle}
      position={engine.position}
      start={clip.value.start}
      value={settingsOf(clip)}
      values={recording ? sourcePeaks(clip, recording) : []}
    >
      {actions}
    </ClipPanel>
  );
}
