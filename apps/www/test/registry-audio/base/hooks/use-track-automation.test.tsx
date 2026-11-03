import { describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useTrackAutomation } from "@/registry-audio/bases/base/hooks/use-track-automation";
import type { ArrangementTrack } from "@/registry-audio/bases/base/lib/arrangement";
import type { ArrangementCommand } from "@/registry-audio/bases/base/lib/arrangement-state";

const POINTS = [
  { x: 0, y: 0.5 },
  { x: 1, y: 1 },
];

/** A track with a volume envelope, and one with none. */
const TRACKS: ArrangementTrack[] = [
  { automation: { volume: POINTS }, color: 0, id: "drums", name: "Drums" },
  { color: 1, id: "keys", name: "Keys" },
];

function setup() {
  const sent: ArrangementCommand[] = [];
  const dispatch = mock((command: ArrangementCommand) => sent.push(command));
  const view = renderHook(() =>
    useTrackAutomation({ dispatch, tracks: TRACKS })
  );
  return { sent, view };
}

describe("useTrackAutomation", () => {
  test("a lane shows the volume until another parameter is chosen, and the mode toggles", () => {
    const { view } = setup();
    expect(view.result.current.parameterOf("drums")).toBe("volume");
    act(() => view.result.current.show("drums", "pan"));
    expect(view.result.current.parameterOf("drums")).toBe("pan");
    expect(view.result.current.automating).toBe(false);
    act(() => view.result.current.toggle());
    expect(view.result.current.automating).toBe(true);
  });

  test("a gain moved by hand on an automated track overrides its envelope, in a burst", () => {
    const { sent, view } = setup();
    act(() => view.result.current.changeMix("drums", { gain: 0.5 }));
    expect(view.result.current.overridden).toEqual({ drums: ["volume"] });
    expect(view.result.current.anyOverridden).toBe(true);
    expect(sent).toEqual([
      { id: "drums", patch: { gain: 0.5 }, type: "change-mix" },
    ]);
  });

  test("a track with no envelope, or a switch, overrides nothing; a switch is a step of its own", () => {
    const { sent, view } = setup();
    act(() => view.result.current.changeMix("keys", { gain: 0.5 }));
    act(() => view.result.current.changeMix("drums", { muted: true }));
    expect(view.result.current.anyOverridden).toBe(false);
    expect(sent.map((command) => command.type)).toEqual([
      "change-mix",
      "set-mix",
    ]);
  });

  test("a color is a command of its own", () => {
    const { sent, view } = setup();
    act(() => view.result.current.changeMix("keys", { color: 3 }));
    expect(sent).toEqual([{ color: 3, id: "keys", type: "set-track-color" }]);
  });

  test("drawing the envelope plays it again, and re-enabling plays every one", () => {
    const { sent, view } = setup();
    act(() => view.result.current.changeMix("drums", { gain: 0.5, pan: 0.2 }));
    expect(view.result.current.overridden.drums).toEqual(["volume"]);
    act(() => view.result.current.edit("drums", "volume", POINTS));
    expect(view.result.current.overridden.drums).toEqual([]);
    expect(sent.at(-1)).toEqual({
      parameter: "volume",
      points: POINTS,
      trackId: "drums",
      type: "change-automation",
    });
    act(() => view.result.current.changeMix("drums", { gain: 0.4 }));
    act(() => view.result.current.reenable());
    expect(view.result.current.anyOverridden).toBe(false);
  });

  test("clearing an envelope is one step of undo", () => {
    const { sent, view } = setup();
    act(() => view.result.current.clear("drums", "volume"));
    expect(sent).toEqual([
      {
        parameter: "volume",
        points: null,
        trackId: "drums",
        type: "change-automation",
      },
      { type: "settle-clip-edit" },
    ]);
  });
});
