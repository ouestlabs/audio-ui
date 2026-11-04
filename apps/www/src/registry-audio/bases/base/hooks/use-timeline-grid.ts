"use client";

import {
  adjacentDivision,
  divisionAt,
  GRID_DIVISIONS,
  type GridDivision,
  gridInterval,
  gridLabel,
  type Tempo,
  TRIPLET_FACTOR,
} from "@audio-ui/core/time";
import { useCallback, useState } from "react";

/** How close an adaptive grid's lines may be, in px: a finer grid halves it, a wider one doubles it. */
const DENSITIES = [6, 12, 24, 48, 96] as const;

/** A change of the grid: finer or wider, triplets, snapping, or a grid fixed where it is (and following the zoom again). */
export type GridChange = "finer" | "fixed" | "snap" | "triplet" | "wider";

/** Cmd/Ctrl + 1 to 5, by the key's place (`KeyboardEvent.code`) so it works on any keyboard layout. */
export const GRID_KEYS: Readonly<Record<string, GridChange>> = {
  Digit1: "finer",
  Digit2: "wider",
  Digit3: "triplet",
  Digit4: "snap",
  Digit5: "fixed",
};

/** The divisions a grid menu lists, as `TimelineGridMenuItems` takes them: adaptive, which follows the zoom, then the fixed ones. */
export const GRID_DIVISION_OPTIONS: { label: string; value: GridDivision }[] = [
  { label: "Adaptive", value: "adaptive" },
  ...GRID_DIVISIONS.map((entry) => ({
    label:
      "bars" in entry
        ? `${entry.bars} ${entry.bars === 1 ? "bar" : "bars"}`
        : entry.id,
    value: entry.id,
  })),
];

/** A finer or wider grid: the next fixed division, or a denser or sparser adaptive one (finer halves how close its lines may be). */
function stepped(division: GridDivision, density: number, finer: boolean) {
  if (division !== "adaptive") {
    return { density, division: adjacentDivision(division, finer ? 1 : -1) };
  }
  const index = DENSITIES.indexOf(density as (typeof DENSITIES)[number]);
  return { density: DENSITIES[index + (finer ? -1 : 1)] ?? density, division };
}

export interface UseTimelineGridOptions {
  /** The grid it starts as: one kept from before, say. @default adaptive, snapping */
  initial?: {
    density: number;
    division: GridDivision;
    snap: boolean;
    triplet: boolean;
  };
  tempo: Tempo;
  /** The timeline's zoom, in px per second: an adaptive grid follows it. */
  zoom: number;
}

/**
 * The grid of an arrangement's timeline: adaptive (lines as close as its
 * density lets them at the zoom) or a fixed division, straight or triplet,
 * snapping or not. `step` is what the lanes draw, `snapStep` what clips,
 * the loop and the cursor snap to (0 with snapping off), and `label` names it
 * for the button that opens `TimelineGridMenuItems`. `change` is what
 * Cmd/Ctrl + 1 to 5 do (`GRID_KEYS`).
 */
export function useTimelineGrid({
  initial,
  tempo,
  zoom,
}: UseTimelineGridOptions) {
  const [division, setDivision] = useState<GridDivision>(
    initial?.division ?? "adaptive"
  );
  const [density, setDensity] = useState<number>(initial?.density ?? 24);
  const [triplet, setTriplet] = useState(initial?.triplet ?? false);
  const [snap, setSnap] = useState(initial?.snap ?? true);
  const step = gridInterval(division, zoom, tempo, {
    minSpacing: density,
    triplet,
  });
  const change = useCallback(
    (kind: GridChange) => {
      if (kind === "triplet") {
        setTriplet((on) => !on);
      } else if (kind === "snap") {
        setSnap((on) => !on);
      } else if (kind === "fixed") {
        // Fixed at the division it shows now, or following the zoom again.
        setDivision(
          division === "adaptive"
            ? divisionAt(step / (triplet ? TRIPLET_FACTOR : 1), tempo)
            : "adaptive"
        );
      } else {
        const next = stepped(division, density, kind === "finer");
        setDivision(next.division);
        setDensity(next.density);
      }
    },
    [density, division, step, tempo, triplet]
  );
  /** For `TimelineGridMenuItems`' `onDivisionChange`. */
  const chooseDivision = useCallback(
    (value: string) => setDivision(value as GridDivision),
    []
  );
  return {
    change,
    chooseDivision,
    /** How close an adaptive grid's lines may be, in px. */
    density,
    division,
    /** The grid's name: its division, or "Snap off". */
    label: snap ? gridLabel(step, tempo) : "Snap off",
    setSnap,
    setTriplet,
    snap,
    /** What clips, the loop and the cursor snap to, in seconds: 0 with snapping off. */
    snapStep: snap ? step : 0,
    /** The grid's step, in seconds: what the lanes draw. */
    step,
    triplet,
  };
}
