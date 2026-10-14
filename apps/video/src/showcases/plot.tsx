import { useMemo } from "react";
import {
  Plot,
  PlotArea,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
} from "@/registry-audio/bases/base/audio/elements/plot";
import { MOTION, ramp, tw } from "../motion.ts";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const RANGE_DB = 15;
const DECADES = Math.log10(MAX_HZ / MIN_HZ);
const DB_TICKS = [-12, -6, 0, 6, 12];
const formatDb = (db: number) => (db > 0 ? `+${db}` : String(db));
const formatHz = (hertz: number) =>
  hertz >= 1000 ? `${hertz / 1000}k` : String(hertz);

/** A band's share of the log-frequency axis. */
const share = (hertz: number) => Math.log10(hertz / MIN_HZ) / DECADES;
const hertzAt = (position: number) => MIN_HZ * 10 ** (position * DECADES);

type Band = { center: number; gain: number; width: number };

/** The middle band is boosted, then all three move a little. */
function bandsAt(t: number): Band[] {
  const breathe = ramp(t - 1, 0.8);
  return [
    { center: 0.2, gain: 3 + Math.sin(t * 0.9) * breathe, width: 0.07 },
    {
      center: 0.5,
      gain: tw(t, 0.4, 1, 0, 8) + 2.5 * Math.sin(t * 1.3) * breathe,
      width: 0.09,
    },
    {
      center: 0.8,
      gain: -4 + 1.5 * Math.sin(t * 1.1 + 2) * breathe,
      width: 0.06,
    },
  ];
}

/** The EQ's gain at `hertz`: a bell per band, on the log-frequency axis. */
const responseOf = (bands: Band[]) => (hertz: number) =>
  bands.reduce(
    (sum, band) =>
      sum +
      band.gain *
        Math.exp(-((share(hertz) - band.center) ** 2) / (2 * band.width ** 2)),
    0
  );

/** A three-band EQ, its handles on the curve. */
export function PlotShowcase({ t }: { t: number }) {
  const bands = useMemo(() => bandsAt(t), [t]);
  const response = useMemo(() => responseOf(bands), [bands]);
  return (
    <div
      className="h-full"
      style={{
        clipPath: `inset(-8px ${(1 - MOTION.enter(ramp(t, 0.7))) * 100}% -8px -8px)`,
      }}
    >
      <Plot
        className="h-full"
        maxX={MAX_HZ}
        maxY={RANGE_DB}
        minX={MIN_HZ}
        minY={-RANGE_DB}
        scaleX="log"
      >
        <PlotGraph>
          <PlotArea fillTo={0} fn={response} />
          <PlotCurve fn={response} />
        </PlotGraph>
        <PlotGrid
          x={{ format: formatHz, ticks: [100, 1000, 10_000] }}
          y={{ format: formatDb, ticks: DB_TICKS }}
        />
        {bands.map((band, index) => {
          const hertz = hertzAt(band.center);
          return (
            <PlotHandle
              aria-label={`Band ${index + 1}`}
              key={band.center}
              value={{ x: hertz, y: response(hertz) }}
            />
          );
        })}
      </Plot>
    </div>
  );
}
