import { type ReactNode, useCallback, useMemo } from "react";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/components/audio-ui/device-panel";
import {
  type BinauralPannerState,
  binauralPannerDevice,
  binauralPlace,
  binauralPoint,
} from "@/components/audio-ui/devices/binaural-panner/device";
import {
  Plot,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
} from "@/components/audio-ui/plot";
import { StereoField } from "@/components/audio-ui/stereo-field";
import type { DeviceSignal } from "@/lib/device-signal";
import { cn } from "@/lib/utils";

const SWITCHES = ["enabled"] as const;
const OFF = binauralPannerDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled");
const SIDES = [-0.7, 0.7];
const formatSide = (at: number) => (at < 0 ? "Left" : "Right");
const formatFacing = (at: number) => (at < 0 ? "Behind" : "Front");
const getAriaLabel = (axis: "x" | "y") =>
  axis === "x" ? "Left to right" : "Behind to in front";

interface BinauralPannerPanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: BinauralPannerState) => void;
  /** Its live sound: where what comes out sits between the speakers, and how alike its sides are. */
  signal?: DeviceSignal;
  value: BinauralPannerState;
}

/**
 * The face of the binaural panner device: the head seen from above, in front
 * up, and a handle for the sound around it, its direction and how far out its
 * distance, over its knobs. Controlled like `DevicePanel`, which it uses for
 * them. Its children sit at the end of the title bar.
 */
function BinauralPannerPanel({
  children,
  className,
  onValueChange,
  signal,
  value,
}: BinauralPannerPanelProps) {
  const point = useMemo(() => binauralPoint(value), [value]);
  const move = useCallback(
    (next: { x: number; y: number }) =>
      onValueChange(
        binauralPannerDevice.apply(value, binauralPlace(next)).state
      ),
    [onValueChange, value]
  );
  const describe = useCallback(
    () =>
      `${binauralPannerDevice.format("azimuthDeg", value.azimuthDeg)}, ${binauralPannerDevice.format("distanceM", value.distanceM)}`,
    [value.azimuthDeg, value.distanceM]
  );
  return (
    <DeviceFrame className={cn("h-full", className)} signal={signal}>
      <DeviceHeader
        activator="enabled"
        device={binauralPannerDevice}
        onValueChange={onValueChange}
        value={value}
      >
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col items-center gap-2 p-2"
        data-slot="binaural-panner-panel"
      >
        <div className="flex min-h-28 w-full grow justify-center gap-4">
          <Plot
            aria-label="The sound around the head, seen from above"
            className="aspect-square h-full w-auto"
            maxX={1}
            maxY={1}
            minX={-1}
            minY={-1}
          >
            <PlotGrid
              x={{ format: formatSide, ticks: SIDES }}
              y={{ format: formatFacing, ticks: SIDES }}
            />
            <PlotGraph>
              <PlotLine axis="x" className="stroke-foreground/40" value={0} />
              <PlotLine axis="y" className="stroke-foreground/40" value={0} />
            </PlotGraph>
            {value.enabled ? (
              <PlotHandle
                aria-label="Where the sound is"
                getAriaLabel={getAriaLabel}
                getAriaValueText={describe}
                onValueChange={move}
                value={point}
              />
            ) : null}
          </Plot>
          {signal ? (
            // Where what comes out sits between the speakers, beside where it is placed around the head.
            <StereoField
              className="w-20 shrink-0 self-center"
              source={signal.output.stereo}
            />
          ) : null}
        </div>
        <DevicePanel
          className="w-full grid-cols-4"
          device={binauralPannerDevice}
          disabled={value.enabled ? undefined : OFF}
          exclude={SWITCHES}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { BinauralPannerPanel };
