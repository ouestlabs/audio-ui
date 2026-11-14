import { DEFAULT_TEMPO, type Tempo } from "@audio-ui/engine/time";
import { type ReactNode, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotTrace,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type AutoPanState,
  autoPanDevice,
  autoPanSweep,
} from "@/registry-audio/bases/base/devices/auto-pan/device";
import type { DeviceSignal } from "@/registry-audio/bases/base/lib/device-signal";

/** Two seconds of the oscillator, whatever the rate: the plot shows what it does meanwhile. */
const WINDOW_SECONDS = 2;
const TIME_TICKS = [0.5, 1, 1.5];
const PERCENT_TICKS = [-50, 0, 50];
const SWITCHES = ["enabled"] as const;
const SYNCED_OFF = ["rateHz"] as const;
const FREE_OFF = ["division"] as const;
const ALL = autoPanDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");

const formatSeconds = (seconds: number) => `${seconds}s`;
const formatPercent = (percent: number) => `${percent}%`;

interface AutoPanPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: AutoPanState) => void;
  /** Its live sound: what its oscillator did over the last two seconds, scrolling, in place of the drawn sweep while sound goes in, and its levels at the edge. */
  signal?: DeviceSignal;
  /** The host's tempo, which a synced rate is read against. @default 120 BPM */
  tempo?: Tempo;
  value: AutoPanState;
}

/**
 * The face of the auto pan device: what the oscillator does to the pan or the level over two seconds, in its waveform, over its knobs. Controlled like `DevicePanel`, which it uses for them. Its children
 * sit at the end of the title bar.
 */
function AutoPanPanel({
  children,
  className,
  onValueChange,
  signal,
  tempo = DEFAULT_TEMPO,
  value,
}: AutoPanPanelProps) {
  const sweep = useMemo(() => autoPanSweep(value, tempo), [tempo, value]);
  // The oscillator as it ran, scaled by the depth as the sweep is: only while it moves anything.
  const moved = value.enabled && value.depth > 0 ? signal?.modulator : null;
  const history = useMemo(
    () => moved?.history({ points: 240, seconds: WINDOW_SECONDS }),
    [moved]
  );
  let unused: readonly (typeof ALL)[number][] = ALL;
  if (value.enabled) {
    unused = value.sync ? SYNCED_OFF : FREE_OFF;
  }
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={autoPanDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="auto-pan-panel"
      >
        <Plot
          aria-label="Movement over two seconds"
          className="h-28 min-h-16 grow"
          maxX={WINDOW_SECONDS}
          maxY={100}
          minX={0}
          minY={-100}
        >
          <PlotGrid
            x={{ format: formatSeconds, ticks: TIME_TICKS }}
            y={{ format: formatPercent, ticks: PERCENT_TICKS }}
          />
          <PlotGraph>
            <PlotCurve
              // The sweep as set while no sound goes in; once it does, the oscillator as it ran.
              className={history ? "hidden group-data-idle/device:inline" : undefined}
              fn={sweep}
            />
            {history ? (
              <PlotTrace
                // Drawn as the sweep is: the same line, as it ran.
                className="stroke-[1.5px] stroke-primary group-data-idle/device:hidden"
                max={100 / value.depth}
                min={-100 / value.depth}
                source={history}
              />
            ) : null}
          </PlotGraph>
        </Plot>
        <DevicePanel
          className="grid-cols-3"
          device={autoPanDevice}
          disabled={unused}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { AutoPanPanel };
