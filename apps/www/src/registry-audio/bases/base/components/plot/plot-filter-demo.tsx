"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Plot,
  PlotArea,
  PlotBand,
  PlotCurve,
  PlotGraph,
  PlotHandle,
  PlotLine,
  PlotMark,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  biquadResponse,
  formatHz,
} from "@/registry-audio/bases/base/lib/filter-response";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MIN_DB = -36;
const MAX_DB = 24;
const BASE_Q = Math.SQRT1_2;
const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const HZ_LABELS = [
  { hz: 100, label: "100" },
  { hz: 1000, label: "1k" },
  { hz: 10_000, label: "10k" },
];
const DB_LABELS = [-24, 0, 12];
const AUDIBLE_HZ: readonly [number, number] = [100, 10_000];

const getAriaLabel = (axis: "x" | "y") =>
  axis === "x" ? "Cutoff" : "Resonance";
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : `${value.toFixed(1)} dB`;

/** A low-pass filter: the handle sits on the resonance peak, so dragging it sets the cutoff and how much it rings. */
export default function PlotFilterDemo() {
  const [filter, setFilter] = useState({ cutoff: 1800, resonanceDb: 8 });
  const changeFilter = useCallback(
    ({ x, y }: { x: number; y: number }) =>
      setFilter({ cutoff: x, resonanceDb: Math.max(0, y) }),
    []
  );
  const response = useMemo(
    () =>
      biquadResponse({
        frequency: filter.cutoff,
        q: BASE_Q * 10 ** (filter.resonanceDb / 20),
        type: "highcut",
      }),
    [filter]
  );

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <Plot
        maxX={MAX_HZ}
        maxY={MAX_DB}
        minX={MIN_HZ}
        minY={MIN_DB}
        scaleX="log"
      >
        <PlotGraph>
          <PlotBand axis="x" from={AUDIBLE_HZ[0]} to={AUDIBLE_HZ[1]} />
          {HZ_LABELS.map(({ hz }) => (
            <PlotLine axis="x" key={hz} value={hz} />
          ))}
          <PlotLine axis="y" className="stroke-foreground/30" value={0} />
          <PlotLine axis="x" value={filter.cutoff} />
          <PlotArea fillTo={MIN_DB} fn={response} />
          <PlotCurve fn={response} />
        </PlotGraph>
        {HZ_LABELS.map(({ hz, label }) => (
          <PlotMark axis="x" key={hz} value={hz}>
            {label}
          </PlotMark>
        ))}
        {DB_LABELS.map((db) => (
          <PlotMark axis="y" key={db} value={db}>
            {formatDbMark(db)}
          </PlotMark>
        ))}
        <PlotHandle
          aria-label="Cutoff and resonance"
          getAriaLabel={getAriaLabel}
          getAriaValueText={describeValue}
          onValueChange={changeFilter}
          value={{ x: filter.cutoff, y: filter.resonanceDb }}
        />
      </Plot>
      <output className="text-center font-mono text-muted-foreground text-xs">
        Cutoff {formatHz(filter.cutoff)}, resonance{" "}
        {filter.resonanceDb.toFixed(1)} dB
      </output>
    </div>
  );
}
