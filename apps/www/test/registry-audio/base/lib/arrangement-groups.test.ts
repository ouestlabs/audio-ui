import { describe, expect, test } from "bun:test";
import {
  type ArrangementCommand,
  apply,
  createArrangementState,
  trackBlock,
  trackDepth,
} from "@/registry-audio/bases/base/lib/arrangement-state";

function setup() {
  return createArrangementState({
    colors: 5,
    duration: 10,
    initialClips: [
      {
        id: "k",
        name: "Kick",
        recording: "r",
        sourceLength: 1,
        track: "kick",
        value: { fadeIn: 0, fadeOut: 0, length: 1, offset: 0, start: 0 },
      },
    ],
    initialTracks: ["kick", "snare", "hats", "bass", "vocal"].map(
      (id, index) => ({ color: index, id, name: id })
    ),
    tempo: { beatUnit: 4, beatsPerBar: 4, bpm: 120 },
  });
}

const run = (commands: ArrangementCommand[]) =>
  commands.reduce((state, command) => apply(state, command), setup());
const layout = (state: ReturnType<typeof setup>) =>
  state.doc.tracks.map((track) =>
    track.group ? `${track.id}<${track.group}` : track.id
  );

describe("groups", () => {
  test("MIX-020: tracks grouped go into a new group where the first of them was, in their order", () => {
    const state = run([{ ids: ["hats", "kick"], type: "group-tracks" }]);
    expect(layout(state)).toEqual([
      "group-1",
      "kick<group-1",
      "hats<group-1",
      "snare",
      "bass",
      "vocal",
    ]);
    expect(state.doc.tracks[0]).toMatchObject({
      kind: "group",
      name: "Group 1",
    });
    expect(state.history.past).toHaveLength(1);
  });

  test("MIX-020: a group within a group, and its block and depth", () => {
    const state = run([
      { ids: ["kick", "snare"], type: "group-tracks" },
      { ids: ["group-1", "hats"], name: "Drums", type: "group-tracks" },
    ]);
    expect(layout(state)).toEqual([
      "group-2",
      "group-1<group-2",
      "kick<group-1",
      "snare<group-1",
      "hats<group-2",
      "bass",
      "vocal",
    ]);
    expect(trackBlock(state.doc.tracks, "group-2")).toEqual([
      "group-2",
      "group-1",
      "kick",
      "snare",
      "hats",
    ]);
    expect(trackDepth(state.doc.tracks, "kick")).toBe(2);
  });

  test("MIX-020: tracks grouped within a group make a group within it", () => {
    const state = run([
      { ids: ["kick", "snare", "hats"], type: "group-tracks" },
      { ids: ["snare", "hats"], type: "group-tracks" },
    ]);
    expect(layout(state)).toEqual([
      "group-1",
      "kick<group-1",
      "group-2<group-1",
      "snare<group-2",
      "hats<group-2",
      "bass",
      "vocal",
    ]);
  });

  test("MIX-020: a group moves with its tracks; a track joins the group of the track it lands before", () => {
    const grouped = run([{ ids: ["kick", "snare"], type: "group-tracks" }]);
    const moved = apply(grouped, {
      id: "group-1",
      index: 3,
      type: "move-track",
    });
    expect(layout(moved)).toEqual([
      "hats",
      "bass",
      "vocal",
      "group-1",
      "kick<group-1",
      "snare<group-1",
    ]);
    const joined = apply(grouped, {
      id: "vocal",
      index: 2,
      type: "move-track",
    });
    expect(layout(joined)).toContain("vocal<group-1");
    const left = apply(grouped, { id: "kick", index: 5, type: "move-track" });
    expect(layout(left).at(-1)).toBe("kick");
  });

  test("MIX-020: ungrouping puts the tracks back where the group was; removing a group takes its tracks and their clips", () => {
    const grouped = run([
      { ids: ["kick", "snare"], type: "group-tracks" },
      { ids: ["group-1"], type: "group-tracks" },
    ]);
    const undone = apply(grouped, { id: "group-1", type: "ungroup" });
    expect(layout(undone)).toEqual([
      "group-2",
      "kick<group-2",
      "snare<group-2",
      "hats",
      "bass",
      "vocal",
    ]);
    const removed = apply(grouped, { id: "group-2", type: "remove-track" });
    expect(layout(removed)).toEqual(["hats", "bass", "vocal"]);
    expect(removed.doc.clips).toEqual([]);
  });

  test("MIX-020: a track added after a group goes after its tracks, beside it", () => {
    const grouped = run([{ ids: ["kick", "snare"], type: "group-tracks" }]);
    const after = apply(grouped, { afterId: "group-1", type: "add-track" });
    expect(layout(after).slice(0, 4)).toEqual([
      "group-1",
      "kick<group-1",
      "snare<group-1",
      "track-7",
    ]);
    const inside = apply(grouped, { afterId: "kick", type: "add-track" });
    expect(layout(inside)[2]).toBe("track-7<group-1");
  });

  test("MIX-020: a group duplicated comes again right after its tracks, with copies of them and their clips", () => {
    const grouped = run([{ ids: ["kick", "snare"], type: "group-tracks" }]);
    const copied = apply(grouped, { id: "group-1", type: "duplicate-track" });
    expect(layout(copied)).toEqual([
      "group-1",
      "kick<group-1",
      "snare<group-1",
      "track-7",
      "track-8<track-7",
      "track-9<track-7",
      "hats",
      "bass",
      "vocal",
    ]);
    expect(copied.doc.tracks[3]?.name).toBe("Group 1 copy");
    expect(copied.doc.clips.map((clip) => clip.track)).toEqual([
      "kick",
      "track-8",
    ]);
    expect(copied.history.past).toHaveLength(2);
  });
});
