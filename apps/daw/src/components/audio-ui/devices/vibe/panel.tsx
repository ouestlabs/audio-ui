import { type ReactNode, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type VibeState,
  vibeDevice,
  vibeLight,
} from "@/components/audio-ui/devices/vibe/device";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
} from "@/components/audio-ui/plot";
import { cn } from "@/lib/utils";

/** Two seconds of the lamp, whatever its speed: the plot shows how it pulses meanwhile. */
const WINDOW_SECONDS = 2;
const TIME_TICKS = [0.5, 1, 1.5];
const LIGHT_TICKS = [0.5];
const SWITCHES = ["enabled"] as const;
const ALL = vibeDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");
const NONE = [] as const;

const formatSeconds = (seconds: number) => `${seconds}s`;
const formatLight = (light: number) => `${Math.round(light * 100)}%`;

interface VibePanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: VibeState) => void;
  value: VibeState;
}

/**
 * The face of the vibe device: the lamp's light over two seconds, rising fast
 * and fading slowly, over its mode and its knobs. Controlled like
 * `DevicePanel`, which it uses for them. Its children sit at the end of the
 * title bar.
 */
function VibePanel({
  children,
  className,
  onValueChange,
  value,
}: VibePanelProps) {
  const light = useMemo(() => vibeLight(value), [value]);
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={vibeDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="vibe-panel"
      >
        <Plot
          aria-label="The lamp's light over two seconds"
          className="h-28 min-h-16 grow"
          maxX={WINDOW_SECONDS}
          maxY={1}
          minX={0}
          minY={0}
        >
          <PlotGrid
            x={{ format: formatSeconds, ticks: TIME_TICKS }}
            y={{ format: formatLight, ticks: LIGHT_TICKS }}
          />
          <PlotGraph>
            <PlotCurve fn={light} />
          </PlotGraph>
        </Plot>
        <DevicePanel
          device={vibeDevice}
          disabled={value.enabled ? NONE : ALL}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { VibePanel };
