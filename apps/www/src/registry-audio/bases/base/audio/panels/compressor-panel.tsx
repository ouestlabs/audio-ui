"use client";

import type { Source } from "@audio-ui/react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCurve,
  PlotDot,
  PlotGraph,
  PlotGrid,
  PlotLine,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
  DeviceToggle,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type CompressorState,
  compressorCurve,
  compressorDevice,
} from "@/registry-audio/bases/base/lib/compressor-device";

const MIN_DB = -60;
const MAX_DB = 6;
const DB_TICKS = [-48, -24, 0];
const UNITY = (inputDb: number) => inputDb;
/** What the knobs gather: the curve, the timing, the output. */
const GROUPS = [
  { label: "Curve", parameters: ["thresholdDb", "ratio", "kneeDb"] },
  { label: "Time", parameters: ["attackMs", "releaseMs"] },
  { label: "Output", parameters: ["makeupDb", "mix", "external"] },
] as const;
const SWITCHES = ["enabled", "autoMakeup"] as const;
/** With auto make-up on, the node's own make-up plays and this knob does nothing. */
const MAKEUP_OFF = ["makeupDb"] as const;

interface CompressorPanelProps {
  /** Whatever the host puts next to the name: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  /** The level going in, in dB, as a live source: a dot rides the curve at it. */
  level?: Source<number>;
  onValueChange: (state: CompressorState) => void;
  value: CompressorState;
}

/**
 * The face of the compressor device: a title bar with the on square and the
 * auto make-up switch, the transfer curve it plays with the threshold and the
 * level going in on it, and its knobs gathered by what they do. It is
 * controlled like `DevicePanel`, which it uses for the knobs: drawing the
 * curve is all it adds. Its children sit at the end of the title bar.
 */
function CompressorPanel({
  children,
  className,
  level,
  onValueChange,
  value,
}: CompressorPanelProps) {
  const output = useMemo(() => compressorCurve(value), [value]);
  const dot = useMemo(
    () =>
      level && {
        getSnapshot: () => {
          const x = level.getSnapshot();
          return { x, y: output(x) };
        },
        subscribe: level.subscribe,
      },
    [level, output]
  );
  // The dot rides the curve while there is a signal; with none it has no place on it.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!(element && level)) {
      return;
    }
    const sync = () =>
      element.toggleAttribute("data-idle", level.getSnapshot() < MIN_DB);
    sync();
    return level.subscribe(sync);
  }, [level]);
  return (
    <div
      className={cn("group/compressor h-full w-full", className)}
      data-idle=""
      data-slot="compressor-panel"
      ref={root}
    >
      <DeviceFrame className="h-full">
        <DeviceHeader
          activator="enabled"
          device={compressorDevice}
          onValueChange={onValueChange}
          value={value}
        >
          {children}
          <DeviceToggle
            device={compressorDevice}
            id="autoMakeup"
            onValueChange={onValueChange}
            value={value}
          />
        </DeviceHeader>
        <div className="flex min-h-0 grow flex-col gap-2 p-2">
          <Plot
            aria-label={
              value.external ? "Threshold of the key" : "Transfer curve"
            }
            className="h-28 min-h-24 grow"
            maxX={MAX_DB}
            maxY={MAX_DB}
            minX={MIN_DB}
            minY={MIN_DB}
          >
            <PlotGrid
              x={{ ticks: DB_TICKS }}
              y={{ ticks: DB_TICKS.slice(0, 2) }}
            />
            <PlotGraph>
              <PlotCurve
                className="stroke-border [stroke-dasharray:4_4]"
                fn={UNITY}
              />
              <PlotLine
                axis="x"
                className="stroke-foreground/40"
                value={value.thresholdDb}
              />
              {value.external ? null : <PlotCurve fn={output} />}
            </PlotGraph>
            {dot && !value.external ? (
              <PlotDot
                className="group-data-idle/compressor:hidden"
                source={dot}
              />
            ) : null}
          </Plot>
          <DevicePanel
            device={compressorDevice}
            disabled={value.autoMakeup ? MAKEUP_OFF : undefined}
            exclude={SWITCHES}
            groups={GROUPS}
            onValueChange={onValueChange}
            value={value}
          />
        </div>
      </DeviceFrame>
    </div>
  );
}

export { CompressorPanel };
