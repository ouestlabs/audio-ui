import { describe, expect, test } from "bun:test";
import type { TrackDevice } from "@/registry-audio/bases/base/lib/arrangement";
import {
  type ArrangementCommand,
  apply,
  createArrangementState,
} from "@/registry-audio/bases/base/lib/arrangement-state";
import { macroPositions } from "@/registry-audio/bases/base/lib/rack";

const fx = (id: string, device = "audioui.delay"): TrackDevice => ({
  device,
  id,
  state: {},
});

function setup() {
  return createArrangementState({
    colors: 5,
    duration: 10,
    initialTracks: [
      {
        color: 0,
        devices: [
          fx("eq", "audioui.equalizer"),
          fx("comp", "audioui.compressor"),
          fx("verb", "audioui.reverb"),
        ],
        id: "a",
        name: "A",
      },
    ],
    tempo: { beatUnit: 4, beatsPerBar: 4, bpm: 120 },
  });
}

const run = (commands: ArrangementCommand[]) =>
  commands.reduce((state, command) => apply(state, command), setup());
const chainOf = (state: ReturnType<typeof setup>) =>
  state.doc.tracks[0]?.devices ?? [];
const rackOf = (state: ReturnType<typeof setup>) =>
  chainOf(state).find((device) => device.rack);

describe("racks", () => {
  test("DEV-010: devices grouped go into a new rack, one chain of them, where the first was", () => {
    const state = run([
      { ids: ["comp", "verb"], track: "a", type: "group-devices" },
    ]);
    expect(chainOf(state).map((device) => device.device)).toEqual([
      "audioui.equalizer",
      "audioui.rack",
    ]);
    const rack = rackOf(state)?.rack;
    expect(rack?.chains).toHaveLength(1);
    expect(rack?.chains[0]?.devices.map((device) => device.id)).toEqual([
      "comp",
      "verb",
    ]);
    expect(rack?.macros).toHaveLength(8);
    expect(state.history.past).toHaveLength(1);
  });

  test("DEV-010: a chain added takes a device, and a device deep in a rack is changed, switched off and removed", () => {
    const grouped = run([{ ids: ["comp"], track: "a", type: "group-devices" }]);
    const rack = rackOf(grouped)?.id ?? "";
    const withChain = apply(grouped, {
      rack,
      track: "a",
      type: "add-rack-chain",
    });
    const chain = rackOf(withChain)?.rack?.chains[1]?.id ?? "";
    expect(rackOf(withChain)?.rack?.chains.map((item) => item.name)).toEqual([
      "Chain 1",
      "Chain 2",
    ]);
    const added = apply(withChain, {
      chain: { chain, rack },
      device: "audioui.utility",
      state: {},
      track: "a",
      type: "add-device",
    });
    const placed = rackOf(added)?.rack?.chains[1]?.devices[0];
    expect(placed?.device).toBe("audioui.utility");
    const changed = apply(added, {
      id: "comp",
      state: { ratio: 8 },
      track: "a",
      type: "set-device",
    });
    expect(rackOf(changed)?.rack?.chains[0]?.devices[0]?.state).toEqual({
      ratio: 8,
    });
    const off = apply(changed, {
      id: "comp",
      track: "a",
      type: "toggle-device",
    });
    expect(rackOf(off)?.rack?.chains[0]?.devices[0]?.on).toBe(false);
    const removed = apply(off, {
      id: "comp",
      track: "a",
      type: "remove-device",
    });
    expect(rackOf(removed)?.rack?.chains[0]?.devices).toEqual([]);
  });

  test("DEV-010: a chain's fader dragged and a macro turned are one step of undo each", () => {
    const grouped = run([{ ids: ["comp"], track: "a", type: "group-devices" }]);
    const rack = rackOf(grouped)?.id ?? "";
    const chain = rackOf(grouped)?.rack?.chains[0]?.id ?? "";
    const dragged = [0.9, 0.7, 0.5].reduce(
      (state, gain) =>
        apply(state, {
          chain,
          mix: { gain },
          rack,
          track: "a",
          type: "change-rack-chain",
        }),
      grouped
    );
    const settled = apply(dragged, { type: "settle-clip-edit" });
    expect(rackOf(settled)?.rack?.chains[0]?.mix).toEqual({
      gain: 0.5,
      muted: false,
      pan: 0,
      soloed: false,
    });
    expect(settled.history.past).toHaveLength(2);
    const turned = apply(
      apply(settled, {
        index: 2,
        rack,
        track: "a",
        type: "set-macro",
        value: 1.5,
      }),
      { type: "settle-clip-edit" }
    );
    expect(rackOf(turned)?.rack?.macros[2]?.value).toBe(1);
    expect(turned.history.past).toHaveLength(3);
  });

  test("DEV-012: a macro maps a parameter once, over a stretch of its travel, and lets it go", () => {
    const grouped = run([{ ids: ["comp"], track: "a", type: "group-devices" }]);
    const rack = rackOf(grouped)?.id ?? "";
    const mapping = { device: "comp", max: 0.8, min: 0.2, parameter: "ratio" };
    const mapped = run([
      { ids: ["comp"], track: "a", type: "group-devices" },
      { index: 0, mapping, rack, track: "a", type: "map-macro" },
      {
        index: 0,
        mapping: { ...mapping, max: 1 },
        rack,
        track: "a",
        type: "map-macro",
      },
      { index: 0, rack, track: "a", type: "set-macro", value: 0.5 },
    ]);
    const macros = rackOf(mapped)?.rack;
    expect(macros?.macros[0]?.mappings).toEqual([{ ...mapping, max: 1 }]);
    expect(
      macroPositions(macros ?? { chains: [], macros: [] })
        .get("comp")
        ?.get("ratio")
    ).toBeCloseTo(0.6);
    const unmapped = apply(mapped, {
      device: "comp",
      index: 0,
      parameter: "ratio",
      rack,
      track: "a",
      type: "unmap-macro",
    });
    expect(rackOf(unmapped)?.rack?.macros[0]?.mappings).toEqual([]);
  });

  test("DEV-010: a rack added from the library comes with one empty chain", () => {
    const state = run([
      { device: "audioui.rack", state: {}, track: "a", type: "add-device" },
    ]);
    expect(rackOf(state)?.rack?.chains).toHaveLength(1);
    expect(rackOf(state)?.rack?.chains[0]?.devices).toEqual([]);
  });
});
