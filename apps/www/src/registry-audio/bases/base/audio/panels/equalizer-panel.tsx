"use client";

import {
  bandGainForHandle,
  bandHandleDb,
  formatDb,
  formatHz,
} from "@audio-ui/core/analysis";
import type { Source } from "@audio-ui/react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import { FilterTypeSelect } from "@/registry-audio/bases/base/audio/elements/filter-type-select";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotTraceArea,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  EQUALIZER_BANDS,
  type EqualizerState,
  equalizerBands,
  equalizerCurve,
  equalizerDevice,
  FILTER_TAKES,
} from "@/registry-audio/bases/base/lib/equalizer-device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MAX_DB = 18;
const DB_TICKS = [-12, 0, 12];
/** The scale a spectrum is drawn on, in dB of level: its own, behind the gain axis. */
const SPECTRUM_MIN_DB = -100;
const SPECTRUM_MAX_DB = -10;
/** What each band is called in the list and over its knobs. */
const BAND_NAMES = ["Low", "Low mid", "High mid", "High"] as const;
/** The knobs of a band, and the output that is always there. */
const OUTPUT = ["outputDb"] as const;
type ParameterId = (typeof equalizerDevice.parameters)[number]["id"];
const ALL_IDS: readonly ParameterId[] = equalizerDevice.parameters.map(
  (parameter) => parameter.id
);
const BAND_IDS: ParameterId[][] = EQUALIZER_BANDS.map((band) => [
  band.hz,
  band.db,
  band.q,
]);
/** What a band can be, as the buttons beside its number. */
const FILTER_ITEMS =
  equalizerDevice
    .describe()
    .parameters.find((parameter) => parameter.id === "lowType")?.options ?? [];

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;
const describeValue = (value: number, axis: "x" | "y") =>
  axis === "x" ? formatHz(value) : formatDb(value);
const clampGain = (gainDb: number) =>
  Math.min(MAX_DB, Math.max(-MAX_DB, gainDb));

interface BandHandleProps {
  index: number;
  onSelect: (index: number) => void;
  onValueChange: (state: EqualizerState) => void;
  selected: boolean;
  value: EqualizerState;
}

/** One band's handle: it sits on the curve, so it follows the pointer one to one. */
function BandHandle({
  index,
  onSelect,
  onValueChange,
  selected,
  value,
}: BandHandleProps) {
  const bands = useMemo(() => equalizerBands(value), [value]);
  const band = EQUALIZER_BANDS[index];
  const change = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      if (!band) {
        return;
      }
      onSelect(index);
      // A cut or a notch has no gain: the handle only slides along the axis.
      if (!FILTER_TAKES[value[band.type]].gain) {
        onValueChange(equalizerDevice.set(value, band.hz, x));
        return;
      }
      const gain = clampGain(bandGainForHandle(bands, index, x, y));
      onValueChange(
        equalizerDevice.apply(value, { [band.db]: gain, [band.hz]: x }).state
      );
    },
    [band, bands, index, onSelect, onValueChange, value]
  );
  const select = useCallback(() => onSelect(index), [index, onSelect]);
  const reset = useCallback(
    () => band && onValueChange(equalizerDevice.set(value, band.db, 0)),
    [band, onValueChange, value]
  );
  if (!band) {
    return null;
  }
  return (
    <PlotHandle
      aria-label={`${BAND_NAMES[index]} band`}
      className={cn(selected && "bg-primary")}
      data-active={selected || undefined}
      getAriaValueText={describeValue}
      onDoubleClick={reset}
      onFocus={select}
      onPointerDown={select}
      onValueChange={change}
      value={{ x: value[band.hz], y: bandHandleDb(bands, index) }}
    />
  );
}

interface BandTabProps {
  index: number;
  onSelect: (index: number) => void;
  selected: boolean;
}

/** A square with the band's number: it picks which band the knobs below show. */
function BandTab({ index, onSelect, selected }: BandTabProps) {
  const pick = useCallback(() => onSelect(index), [index, onSelect]);
  return (
    <Toggle
      aria-label={`${BAND_NAMES[index]} band`}
      className="size-6 min-h-0 min-w-0 p-0 font-mono text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      onPressedChange={pick}
      pressed={selected}
      size="sm"
      variant="outline"
    >
      {index + 1}
    </Toggle>
  );
}

interface EqualizerPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: EqualizerState) => void;
  /** A live spectrum behind the curve, such as from `useSpectrum`. */
  spectrum?: Source<Float32Array>;
  value: EqualizerState;
}

/**
 * The face of the equalizer device: a title bar with the on square, the curve
 * it plays with a handle on each band, and the knobs of the band you picked
 * (its number, or its handle) beside the output. Drag a handle to set the
 * band's frequency and gain, double-click to flatten it. It is controlled like
 * `DevicePanel`, which it uses for the knobs. Its children sit at the end of
 * the title bar.
 */
function EqualizerPanel({
  children,
  className,
  onValueChange,
  spectrum,
  value,
}: EqualizerPanelProps) {
  const [selected, setSelected] = useState(1);
  const curve = useMemo(() => equalizerCurve(value), [value]);
  const picked = EQUALIZER_BANDS[selected];
  const type = picked ? value[picked.type] : "peak";
  const takes = FILTER_TAKES[type];
  // Off, every knob is drawn off; on, the ones the type does not use are.
  const unused = useMemo<readonly ParameterId[]>(() => {
    if (!(picked && value.enabled)) {
      return [...(BAND_IDS[selected] ?? []), ...OUTPUT];
    }
    return [...(takes.gain ? [] : [picked.db]), ...(takes.q ? [] : [picked.q])];
  }, [picked, selected, takes, value.enabled]);
  const pickType = useCallback(
    (next: string | null) => {
      if (picked && next) {
        onValueChange(equalizerDevice.set(value, picked.type, next));
      }
    },
    [picked, onValueChange, value]
  );
  // Two rows of knobs from one device: the one picked, and the output apart.
  const hiddenFromBand = useMemo(
    () => ALL_IDS.filter((id) => !BAND_IDS[selected]?.includes(id)),
    [selected]
  );
  const hiddenFromOutput = useMemo(
    () => ALL_IDS.filter((id) => !OUTPUT.includes(id as never)),
    []
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={equalizerDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-3 p-3"
        data-slot="equalizer-panel"
      >
        <Plot
          aria-label="Frequency response"
          className="min-h-40 grow"
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
          <PlotGraph>
            {spectrum ? (
              <PlotTraceArea
                fillTo={SPECTRUM_MIN_DB}
                max={SPECTRUM_MAX_DB}
                min={SPECTRUM_MIN_DB}
                source={spectrum}
              />
            ) : null}
            <PlotArea fillTo={0} fn={curve} />
            <PlotCurve fn={curve} />
          </PlotGraph>
          {value.enabled
            ? EQUALIZER_BANDS.map((band, index) => (
                <BandHandle
                  index={index}
                  key={band.id}
                  onSelect={setSelected}
                  onValueChange={onValueChange}
                  selected={index === selected}
                  value={value}
                />
              ))
            : null}
        </Plot>
        <div className="flex items-center gap-1.5">
          {EQUALIZER_BANDS.map((band, index) => (
            <BandTab
              index={index}
              key={band.id}
              onSelect={setSelected}
              selected={index === selected}
            />
          ))}
          <FilterTypeSelect
            aria-label={`${BAND_NAMES[selected]} filter type`}
            className="ms-auto w-auto"
            disabled={!value.enabled}
            onValueChange={pickType}
            options={FILTER_ITEMS}
            value={type}
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] items-start gap-x-4">
          <DevicePanel
            className="grid-cols-3"
            device={equalizerDevice}
            disabled={unused}
            exclude={hiddenFromBand}
            labelPrefix={BAND_NAMES[selected]}
            onValueChange={onValueChange}
            value={value}
          />
          <DevicePanel
            className="border-s ps-4"
            device={equalizerDevice}
            disabled={unused}
            exclude={hiddenFromOutput}
            onValueChange={onValueChange}
            value={value}
          />
        </div>
      </div>
    </DeviceFrame>
  );
}

export { EqualizerPanel };
