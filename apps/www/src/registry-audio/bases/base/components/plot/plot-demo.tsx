"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import {
  Plot,
  PlotArea,
  PlotCurve,
  PlotGraph,
  PlotHandle,
  PlotLine,
  PlotMark,
  PlotTraceArea,
  useValueAtPointer,
} from "@/registry-audio/bases/base/audio/elements/plot";
import { useNoiseThroughEq } from "@/registry-audio/bases/base/hooks/use-noise-through-eq";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";
import {
  bandGainForHandle,
  bandHandleDb,
  biquadResponse,
  type EqBand,
  eqResponse,
  formatDb,
  formatHz,
} from "@/registry-audio/bases/base/lib/filter-response";

type Band = EqBand & { id: number };

const BANDS: Band[] = [
  { frequency: 90, gainDb: 3, id: 1, type: "lowshelf" },
  { frequency: 1200, gainDb: -4, id: 2, q: 1.2, type: "peak" },
  { frequency: 7000, gainDb: 5, id: 3, type: "highshelf" },
];
const MAX_BANDS = 8;
const NEW_BAND_Q = 1;
const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MAX_DB = 18;
const MIN_Q = 0.3;
const MAX_Q = 12;
/** How far one unit of wheel delta widens or narrows a band, as an exponent. */
const WHEEL_Q_SENSITIVITY = 0.002;
/** The scale the spectrum is drawn on, in dB of level: its own, behind the gain axis. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
const DB_LABELS = [-12, 0, 12];
const HZ_LABELS = [
  { hz: 100, label: "100" },
  { hz: 1000, label: "1k" },
  { hz: 10_000, label: "10k" },
];

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : formatDb(value);
const clampGain = (gainDb: number) =>
  Math.min(MAX_DB, Math.max(-MAX_DB, gainDb));

interface BandHandleProps {
  active: boolean;
  bands: readonly EqBand[];
  index: number;
  onChange: (index: number, patch: Partial<EqBand>) => void;
  onRemove: (index: number) => void;
  onSelect: (index: number) => void;
}

interface BandAdderProps {
  bands: readonly EqBand[];
  onAdd: (frequency: number, gainDb: number) => void;
}

/** The plot's empty space: double-click it to add a band there, so its handle lands under the pointer. */
function BandAdder({ bands, onAdd }: BandAdderProps) {
  const valueAt = useValueAtPointer();
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const point = valueAt(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      // The gain that puts a new bell's handle at the pointer, on top of what is already there.
      const gainDb = point.y - eqResponse(bands)(point.x);
      onAdd(point.x, clampGain(gainDb));
    },
    [bands, onAdd, valueAt]
  );
  // A mouse gesture with a keyboard equivalent: the handles' own Enter-free
  // path is the keyboard add below the plot.
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut; adding a band has its own button.
    <div className="absolute inset-0" onDoubleClick={handleDoubleClick} />
  );
}

/**
 * One band's handle. It sits on the equalizer's curve, so it follows the
 * pointer one to one; the wheel widens or narrows the band, and a
 * double-click flattens it.
 */
function BandHandle({
  active,
  bands,
  index,
  onChange,
  onRemove,
  onSelect,
}: BandHandleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const band = bands[index];
  const q = band?.q;

  // Attached natively: React listens to wheel passively, so it could not
  // stop the page from scrolling while the wheel widens the band.
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      onSelect(index);
      const next = (q ?? 1) * Math.exp(-event.deltaY * WHEEL_Q_SENSITIVITY);
      onChange(index, { q: Math.min(MAX_Q, Math.max(MIN_Q, next)) });
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [index, onChange, onSelect, q]);

  const handleChange = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      onSelect(index);
      onChange(index, {
        frequency: x,
        gainDb: clampGain(bandGainForHandle(bands, index, x, y)),
      });
    },
    [bands, index, onChange, onSelect]
  );
  const reset = useCallback(
    () => onChange(index, { gainDb: 0 }),
    [index, onChange]
  );
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onRemove(index);
      }
    },
    [index, onRemove]
  );

  return (
    <PlotHandle
      aria-label={`Band ${index + 1}`}
      data-active={active || undefined}
      getAriaValueText={describeValue}
      onDoubleClick={reset}
      onKeyDown={handleKeyDown}
      onValueChange={handleChange}
      ref={ref}
      value={{
        x: band?.frequency ?? MIN_HZ,
        y: bandHandleDb(bands, index),
      }}
    />
  );
}

/**
 * An equalizer. Each band's handle sits on the curve: drag it to set the
 * band's frequency and gain, scroll over it to widen or narrow the band,
 * double-click to flatten it. The selected band's own curve is drawn in
 * the foreground, the others faintly.
 */
export default function PlotDemo() {
  const [bands, setBands] = useState<Band[]>(BANDS);
  const nextId = useRef(BANDS.length + 1);
  const [selectedRaw, setSelected] = useState(1);
  const selected = Math.min(selectedRaw, Math.max(0, bands.length - 1));
  const response = useMemo(() => eqResponse(bands), [bands]);
  const bandCurves = useMemo(
    () => bands.map((item) => biquadResponse(item)),
    [bands]
  );
  const addBand = useCallback((frequency: number, gainDb: number) => {
    setBands((current) => {
      if (current.length >= MAX_BANDS) {
        return current;
      }
      nextId.current += 1;
      setSelected(current.length);
      return [
        ...current,
        {
          frequency,
          gainDb,
          id: nextId.current,
          q: NEW_BAND_Q,
          type: "peak",
        },
      ];
    });
  }, []);
  const removeBand = useCallback((index: number) => {
    setBands((current) => current.filter((_, at) => at !== index));
    setSelected((current) =>
      Math.max(0, current > index ? current - 1 : current)
    );
  }, []);
  const changeBand = useCallback((index: number, patch: Partial<EqBand>) => {
    setBands((current) =>
      current.map((other, at) =>
        at === index ? { ...other, ...patch } : other
      )
    );
  }, []);
  const band = bands[selected];
  const { analyser, playing, toggle } = useNoiseThroughEq(bands);
  const spectrum = useSpectrum(analyser, { maxHz: MAX_HZ, minHz: MIN_HZ });

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <Plot
        className="h-40"
        maxX={MAX_HZ}
        maxY={MAX_DB}
        minX={MIN_HZ}
        minY={-MAX_DB}
        scaleX="log"
      >
        <BandAdder bands={bands} onAdd={addBand} />
        <PlotGraph>
          {HZ_LABELS.map(({ hz }) => (
            <PlotLine axis="x" key={hz} value={hz} />
          ))}
          {DB_LABELS.map((db) => (
            <PlotLine
              axis="y"
              className={db === 0 ? "stroke-foreground/30" : undefined}
              key={db}
              value={db}
            />
          ))}
          <PlotTraceArea
            fillTo={SPECTRUM_MIN_DB}
            max={SPECTRUM_MAX_DB}
            min={SPECTRUM_MIN_DB}
            source={spectrum}
          />
          {bandCurves.map((curve, index) => (
            <PlotCurve
              className={
                index === selected
                  ? "stroke-primary/60 [stroke-dasharray:3_3]"
                  : "stroke-foreground/10"
              }
              fn={curve}
              // The bands never come or go, so their order is their identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed list.
              key={index}
            />
          ))}
          <PlotArea fillTo={0} fn={response} />
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
        {bands.map((item, index) => (
          <BandHandle
            active={index === selected}
            bands={bands}
            index={index}
            key={item.id}
            onChange={changeBand}
            onRemove={removeBand}
            onSelect={setSelected}
          />
        ))}
      </Plot>
      <p className="text-center text-muted-foreground text-xs">
        Double-click to add a band, Delete to remove one, scroll over it to
        change its width.
      </p>
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-label={
            playing ? "Stop the noise" : "Play pink noise through the equalizer"
          }
          onClick={toggle}
          size="icon-sm"
          variant="outline"
        >
          <IconPlaceholder
            hugeicons={playing ? "PauseIcon" : "PlayIcon"}
            lucide={playing ? "PauseIcon" : "PlayIcon"}
            phosphor={playing ? "PauseIcon" : "PlayIcon"}
            remixicon={playing ? "RiPauseLine" : "RiPlayLine"}
            tabler={playing ? "IconPlayerPause" : "IconPlayerPlay"}
          />
        </Button>
        <output className="font-mono text-muted-foreground text-xs">
          Band {selected + 1}: {formatHz(band?.frequency ?? 0)},{" "}
          {formatDb(band?.gainDb ?? 0)}
          {band?.q === undefined ? "" : `, Q ${band.q.toFixed(1)}`}
        </output>
      </div>
    </div>
  );
}
