"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Plot,
  PlotArea,
  PlotCurve,
  PlotGraph,
  PlotHandle,
  PlotLine,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  type EqBand,
  eqResponse,
  formatDb,
  formatHz,
} from "@/registry-audio/bases/base/lib/filter-response";

const BANDS: EqBand[] = [
  { frequency: 90, gainDb: 3, type: "lowshelf" },
  { frequency: 1200, gainDb: -4, q: 1.2, type: "peak" },
  { frequency: 7000, gainDb: 5, type: "highshelf" },
];
const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MAX_DB = 18;
const DB_LABELS = [-12, 0, 12];

const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : formatDb(value);

interface BandHandleProps {
  band: EqBand;
  index: number;
  onChange: (index: number, frequency: number, gainDb: number) => void;
}

/** One band's handle: its frequency across, its gain up. */
function BandHandle({ band, index, onChange }: BandHandleProps) {
  const handleChange = useCallback(
    ({ x, y }: { x: number; y: number }) => onChange(index, x, y),
    [index, onChange]
  );
  return (
    <PlotHandle
      aria-label={`Band ${index + 1}`}
      getAriaValueText={describeValue}
      onValueChange={handleChange}
      value={{ x: band.frequency, y: band.gainDb ?? 0 }}
    />
  );
}

/** An equalizer: drag each band to set its frequency and gain; the curve is the response of all three. */
export default function PlotDemo() {
  const [bands, setBands] = useState(BANDS);
  const [selected, setSelected] = useState(1);
  const response = useMemo(() => eqResponse(bands), [bands]);
  const changeBand = useCallback(
    (index: number, frequency: number, gainDb: number) => {
      setSelected(index);
      setBands((current) =>
        current.map((other, at) =>
          at === index ? { ...other, frequency, gainDb } : other
        )
      );
    },
    []
  );
  const band = bands[selected];

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <Plot
        maxX={MAX_HZ}
        maxY={MAX_DB}
        minX={MIN_HZ}
        minY={-MAX_DB}
        scaleX="log"
      >
        <PlotGraph>
          {DB_LABELS.map((db) => (
            <PlotLine axis="y" key={db} value={db} />
          ))}
          <PlotArea fillTo={0} fn={response} />
          <PlotCurve fn={response} />
        </PlotGraph>
        {bands.map((item, index) => (
          <BandHandle
            band={item}
            index={index}
            // The bands never come or go, so their order is their identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed list.
            key={index}
            onChange={changeBand}
          />
        ))}
      </Plot>
      <output className="text-center font-mono text-muted-foreground text-xs">
        Band {selected + 1}: {formatHz(band?.frequency ?? 0)},{" "}
        {formatDb(band?.gainDb ?? 0)}
      </output>
    </div>
  );
}
