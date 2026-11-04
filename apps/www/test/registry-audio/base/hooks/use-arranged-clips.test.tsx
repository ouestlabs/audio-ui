import { describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useArrangedClips } from "@/registry-audio/bases/base/hooks/use-arranged-clips";
import type { Arranged } from "@/registry-audio/bases/base/lib/arrangement";
import type { ArrangementCommand } from "@/registry-audio/bases/base/lib/arrangement-state";

const clip = (id: string, track: string, notes?: Arranged["notes"]) =>
  ({
    id,
    name: id,
    notes,
    sourceLength: 2,
    track,
    value: { fadeIn: 0, fadeOut: 0, length: 2, offset: 0, start: 0 },
  }) as Arranged;

const AUDIO = clip("audio", "a");
const MIDI = clip("midi", "m", []);
const TRACKS = [
  { color: 0, id: "a", name: "A" },
  { color: 1, id: "m", kind: "midi" as const, name: "M" },
];

function setup(selectedIds: string[] = [], copying: Arranged[] = []) {
  const sent: ArrangementCommand[] = [];
  const onEdit = mock((_id: string) => undefined);
  const onPress = mock(() => undefined);
  const view = renderHook(() =>
    useArrangedClips({
      clips: [AUDIO, MIDI],
      copying,
      dispatch: (command) => sent.push(command),
      getPosition: () => 3,
      onEdit,
      onPress,
      selectedIds,
      splitStep: 0.5,
      tracks: TRACKS,
      viewportRef: { current: null },
    })
  );
  return { onEdit, onPress, sent, view };
}

/** A drop on a lane named `track`. */
const dropOn = (track: string, copy = false) => {
  const lane = document.createElement("div");
  lane.dataset.track = track;
  return {
    copy,
    event: { clientY: 0 },
    lane,
    reason: "drag",
    target: "move",
  } as never;
};

describe("useArrangedClips", () => {
  test("a clip dropped on a track that takes what it holds moves to it", () => {
    const { sent, view } = setup();
    view.result.current.clipProps(AUDIO).onCommit("audio", dropOn("a"));
    view.result.current.clipProps(MIDI).onCommit("midi", dropOn("m", true));
    expect(sent).toEqual([
      { copy: false, id: "audio", track: "a", type: "commit-clip" },
      { copy: true, id: "midi", track: "m", type: "commit-clip" },
    ]);
  });

  test("on a track that does not, or a return track, it stays on its own", () => {
    const { sent, view } = setup();
    view.result.current.clipProps(AUDIO).onCommit("audio", dropOn("m"));
    view.result.current.clipProps(MIDI).onCommit("midi", dropOn("a"));
    view.result.current.clipProps(AUDIO).onCommit("audio", dropOn("return"));
    expect(sent.map((command) => "track" in command && command.track)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  test("Edit selects the clip and tells the host; a split cuts at the cursor", () => {
    const { onEdit, onPress, sent, view } = setup();
    const { onAction } = view.result.current.clipProps(AUDIO);
    onAction("edit", "audio");
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith("audio");
    expect(sent).toEqual([
      { additive: false, id: "audio", type: "select-clip" },
    ]);
    onAction("split", "audio");
    expect(sent.at(-1)).toEqual({
      action: "split",
      at: 3,
      id: "audio",
      step: 0.5,
      type: "clip-action",
    });
  });

  test("the rest of a selection follows a clip dragged up or down, not the clip itself", () => {
    const { view } = setup(["audio", "midi"]);
    act(() => view.result.current.clipProps(AUDIO).onLift("audio", 30));
    expect(view.result.current.clipProps(AUDIO).lift).toBe(0);
    expect(view.result.current.clipProps(MIDI).lift).toBe(30);
    act(() => view.result.current.clipProps(AUDIO).onLift("audio", 0));
    expect(view.result.current.clipProps(MIDI).lift).toBe(0);
  });

  test("the originals of a copy stay on their tracks", () => {
    const { view } = setup([], [AUDIO]);
    expect(view.result.current.ghostsOn("a")).toEqual([AUDIO]);
    expect(view.result.current.ghostsOn("m")).toEqual([]);
    expect(view.result.current.clipProps(AUDIO).copying).toBe(true);
  });
});
