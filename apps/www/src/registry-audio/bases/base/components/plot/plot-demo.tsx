"use client";

import {
  type BiquadType,
  bandGainForHandle,
  bandHandleDb,
  biquadResponse,
  type EqBand,
  eqResponse,
  formatDb,
  formatHz,
} from "@audio-ui/core/analysis";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/base/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotTraceArea,
  useValueAtPointer,
} from "@/registry-audio/bases/base/audio/elements/plot";
import { useNoiseThroughEq } from "@/registry-audio/bases/base/hooks/use-noise-through-eq";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";

type Band = EqBand & { id: number };

const BANDS: Band[] = [
  { frequency: 90, gainDb: 3, id: 1, type: "lowshelf" },
  { frequency: 1200, gainDb: -4, id: 2, q: 1.2, type: "peak" },
  { frequency: 7000, gainDb: 5, id: 3, type: "highshelf" },
];
const MAX_BANDS = 8;
/** How far a press may move and still count as a click, in pixels. */
const CLICK_TOLERANCE = 4;
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
const DB_TICKS = [-12, 0, 12];
/** What a band can be, from the bottom of the spectrum up. */
const BAND_TYPES: { label: string; value: BiquadType }[] = [
  { label: "Low cut", value: "lowcut" },
  { label: "Low shelf", value: "lowshelf" },
  { label: "Bell", value: "peak" },
  { label: "Notch", value: "notch" },
  { label: "High shelf", value: "highshelf" },
  { label: "High cut", value: "highcut" },
];
/** The width a band has when it was never given one. */
const DEFAULT_Q = Math.SQRT1_2;

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : formatDb(value);
const clampGain = (gainDb: number) =>
  Math.min(MAX_DB, Math.max(-MAX_DB, gainDb));

interface BandHandleProps {
  active: boolean;
  bands: readonly EqBand[];
  editing: boolean;
  index: number;
  onChange: (index: number, patch: Partial<EqBand>) => void;
  onEdit: (index: number | null) => void;
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

interface BandEditorProps {
  band: EqBand;
  index: number;
  onChange: (index: number, patch: Partial<EqBand>) => void;
}

const formatQ = (q: number) => `Q ${q.toFixed(1)}`;

/** What a band is and how wide: its type, and its Q on a logarithmic knob. */
function BandEditor({ band, index, onChange }: BandEditorProps) {
  const handleTypeChange = useCallback(
    (type: BiquadType | null) => {
      if (type) {
        onChange(index, { type });
      }
    },
    [index, onChange]
  );
  const handleWidthChange = useCallback(
    (q: number) => onChange(index, { q }),
    [index, onChange]
  );

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-medium text-xs">Band {index + 1}</span>
        <Select
          items={BAND_TYPES}
          onValueChange={handleTypeChange}
          value={band.type}
        >
          <SelectTrigger
            aria-label={`Band ${index + 1} type`}
            className="w-28"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {BAND_TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Knob
        aria-label={`Band ${index + 1} width`}
        className="mb-5"
        formatValue={formatQ}
        max={MAX_Q}
        min={MIN_Q}
        onValueChange={handleWidthChange}
        scale="log"
        size="sm"
        step={0.01}
        value={band.q ?? DEFAULT_Q}
        valueLabel="always"
      />
    </div>
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
  editing,
  index,
  onChange,
  onEdit,
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
      } else if (event.key === "Enter") {
        event.preventDefault();
        onSelect(index);
        onEdit(index);
      }
    },
    [index, onEdit, onRemove, onSelect]
  );
  // A press that stays where it started is a click, not a drag: it opens the band's settings.
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    pressRef.current = { x: event.clientX, y: event.clientY };
  }, []);
  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      const start = pressRef.current;
      pressRef.current = null;
      if (
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) <
          CLICK_TOLERANCE
      ) {
        onSelect(index);
        onEdit(index);
      }
    },
    [index, onEdit, onSelect]
  );
  // A right-click, or a long press on a touch screen, opens it too.
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      onSelect(index);
      onEdit(index);
    },
    [index, onEdit, onSelect]
  );
  const handleOpenChange = useCallback(
    (open: boolean) => {
      onEdit(open ? index : null);
      if (!open) {
        // The popover took the focus: hand it back to the handle.
        ref.current?.querySelector("input")?.focus();
      }
    },
    [index, onEdit]
  );

  return (
    <Popover onOpenChange={handleOpenChange} open={editing}>
      <PlotHandle
        aria-label={`Band ${index + 1}`}
        data-active={active || undefined}
        getAriaValueText={describeValue}
        onContextMenu={handleContextMenu}
        onDoubleClick={reset}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onValueChange={handleChange}
        ref={ref}
        value={{
          x: band?.frequency ?? MIN_HZ,
          y: bandHandleDb(bands, index),
        }}
      >
        <PopoverTrigger
          nativeButton={false}
          render={
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            />
          }
        />
      </PlotHandle>
      <PopoverContent
        align="center"
        className="w-60 p-3"
        side="top"
        sideOffset={12}
      >
        {band ? (
          <BandEditor band={band} index={index} onChange={onChange} />
        ) : null}
      </PopoverContent>
    </Popover>
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
  const [editing, setEditing] = useState<number | null>(null);
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
  const { analyser } = useNoiseThroughEq(bands);
  const spectrum = useSpectrum(analyser, { maxHz: MAX_HZ, minHz: MIN_HZ });

  return (
    <div className="flex w-full flex-col gap-2">
      <Plot
        className="h-40"
        maxX={MAX_HZ}
        maxY={MAX_DB}
        minX={MIN_HZ}
        minY={-MAX_DB}
        scaleX="log"
      >
        <PlotCursor format={describePointer} />
        <PlotGrid
          x={{ count: 6 }}
          y={{ format: formatDbMark, ticks: DB_TICKS }}
        />
        <BandAdder bands={bands} onAdd={addBand} />
        <PlotGraph>
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
        {bands.map((item, index) => (
          <BandHandle
            active={index === selected}
            bands={bands}
            editing={index === editing}
            index={index}
            key={item.id}
            onChange={changeBand}
            onEdit={setEditing}
            onRemove={removeBand}
            onSelect={setSelected}
          />
        ))}
      </Plot>
      <div className="flex items-center justify-end gap-2">
        <output className="font-mono text-muted-foreground text-xs">
          Band {selected + 1}: {formatHz(band?.frequency ?? 0)},{" "}
          {formatDb(band?.gainDb ?? 0)}
          {band?.q === undefined ? "" : `, Q ${band.q.toFixed(1)}`}
        </output>
      </div>
    </div>
  );
}
