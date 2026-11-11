"use client";

import { formatDb, formatHz } from "@audio-ui/engine/analysis";
import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import {
  Plot,
  PlotArea,
  PlotCursor,
  PlotCurve,
  PlotGraph,
  PlotGrid,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  GRAPHIC_EQ_BANDS,
  type GraphicEqState,
  graphicEqCurve,
  graphicEqDevice,
} from "@/registry-audio/bases/base/devices/graphic-eq/device";

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const MAX_DB = 18;
const DB_TICKS = [-12, 0, 12];
/** What the panel draws itself: a fader per band. */
const DRAWN = ["enabled", ...GRAPHIC_EQ_BANDS.map((band) => band.id)] as const;
const OFF = ["outputDb"] as const;
/** A band's range and step, the same for all ten. */
const [, BAND] = graphicEqDevice.parameters;
/** Each band's name, as the device gives it: what a fader is announced by. */
const LABELS = Object.fromEntries(
  graphicEqDevice.parameters.map((parameter) => [parameter.id, parameter.label])
);

const formatDbMark = (db: number) => (db > 0 ? `+${db}` : String(db));
const describePointer = (point: { x: number; y: number }) =>
  `${formatHz(point.x)} · ${formatDb(point.y)}`;

type BandId = (typeof GRAPHIC_EQ_BANDS)[number]["id"];

interface BandProps {
  disabled: boolean;
  id: BandId;
  mark: string;
  onChange: (id: BandId, db: number) => void;
  value: number;
}

/** A band: a fader for its gain, its frequency under it. */
function Band({ disabled, id, mark, onChange, value }: BandProps) {
  const change = useCallback((db: number) => onChange(id, db), [id, onChange]);
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
      <Fader
        anchor={BAND.anchor}
        aria-label={LABELS[id]}
        className="min-h-0 flex-1 [--fader-min-height:5rem]"
        disabled={disabled}
        formatValue={formatDb}
        max={BAND.max}
        min={BAND.min}
        onValueChange={change}
        size="sm"
        step={BAND.step}
        thumbMarks={false}
        value={value}
        valueLabel="hidden"
      />
      <span
        aria-hidden="true"
        className="font-mono text-[10px] text-muted-foreground"
      >
        {mark}
      </span>
    </div>
  );
}

interface GraphicEqPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: GraphicEqState) => void;
  value: GraphicEqState;
}

/**
 * The face of the graphic EQ device: the curve it plays over a fader for each
 * of its ten bands, as on a graphic equalizer, and the output knob beside
 * them. Controlled like `DevicePanel`, which it uses for the knob. Its
 * children sit at the end of the title bar.
 */
function GraphicEqPanel({
  children,
  className,
  onValueChange,
  value,
}: GraphicEqPanelProps) {
  const curve = useMemo(() => graphicEqCurve(value), [value]);
  const setBand = useCallback(
    (id: BandId, db: number) =>
      onValueChange(graphicEqDevice.set(value, id, db)),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={graphicEqDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="graphic-eq-panel"
      >
        <Plot
          aria-label="Frequency response"
          className="h-24 min-h-16 grow"
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
            <PlotArea fillTo={0} fn={curve} />
            <PlotCurve fn={curve} />
          </PlotGraph>
        </Plot>
        <div className="flex min-h-0 gap-3">
          <div
            aria-label="Bands"
            className="flex min-h-0 flex-1 gap-1 pt-1"
            role="group"
          >
            {GRAPHIC_EQ_BANDS.map((band) => (
              <Band
                disabled={!value.enabled}
                id={band.id}
                key={band.id}
                mark={band.mark}
                onChange={setBand}
                value={value[band.id]}
              />
            ))}
          </div>
          <DevicePanel
            device={graphicEqDevice}
            disabled={value.enabled ? undefined : OFF}
            exclude={DRAWN}
            onValueChange={onValueChange}
            value={value}
          />
        </div>
      </div>
    </DeviceFrame>
  );
}

export { GraphicEqPanel };
