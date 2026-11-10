"use client";

import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import {
  Plot,
  PlotCurve,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
} from "@/registry-audio/bases/base/audio/elements/plot";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  type GateState,
  gateCurve,
  gateDevice,
  gateUnused,
} from "@/registry-audio/bases/base/devices/gate/device";

const MIN_DB = -80;
const MAX_DB = 0;
const DB_TICKS = [-48, -24, 0];
const UNITY = (inputDb: number) => inputDb;
const IN_THE_TITLE_BAR = ["enabled", "model"] as const;
const MODELS =
  gateDevice.parameters.find((parameter) => parameter.id === "model")
    ?.options ?? [];
const OFF = gateDevice.parameters
  .map((parameter) => parameter.id)
  .filter((id) => id !== "enabled" && id !== "model");

const describeValue = (value: number) => `${value.toFixed(1)} dB`;

interface GatePanelProps {
  /** Whatever the host puts at the end of the title bar: a play button, a reading. */
  children?: ReactNode;
  className?: string;
  onValueChange: (state: GateState) => void;
  value: GateState;
}

/**
 * The face of the gate device: the model picked in its title bar, its
 * transfer curve against the straight line of a clean sound, with a handle on
 * the threshold to drag across and, for the hysteresis model, a line where it
 * closes, over the knobs, those the model does not use drawn off.
 * With the sidechain on, what the gate does to the signal depends on the other
 * signal, so the curve is not drawn: the plot keeps the threshold, which is a
 * level of the sidechain then.
 * Controlled like `DevicePanel`, which it uses for the knobs. Its children sit
 * at the end of the title bar.
 */
function GatePanel({
  children,
  className,
  onValueChange,
  value,
}: GatePanelProps) {
  const curve = useMemo(() => gateCurve(value), [value]);
  const pickModel = useCallback(
    (model: string | null) => {
      if (model) {
        onValueChange(gateDevice.set(value, "model", model));
      }
    },
    [onValueChange, value]
  );
  const keyed = value.model === "clean" && value.external;
  const change = useCallback(
    ({ x }: { x: number }) =>
      onValueChange(gateDevice.apply(value, { thresholdDb: x }).state),
    [onValueChange, value]
  );
  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        activator="enabled"
        device={gateDevice}
        onValueChange={onValueChange}
        value={value}
      >
        <Select
          disabled={!value.enabled}
          items={MODELS}
          onValueChange={pickModel}
          value={value.model}
        >
          <SelectTrigger
            aria-label="Model"
            className="w-32 data-[size=sm]:h-6"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="gate-panel"
      >
        <Plot
          aria-label={keyed ? "Threshold of the sidechain" : "Transfer curve"}
          className="h-28 min-h-16 grow"
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
            {keyed ? null : (
              <PlotCurve
                className="stroke-border [stroke-dasharray:4_4]"
                fn={UNITY}
              />
            )}
            <PlotLine
              axis="x"
              className="stroke-foreground/40"
              value={value.thresholdDb}
            />
            {value.model === "hysteresis" ? (
              <PlotLine
                axis="x"
                className="stroke-foreground/40 [stroke-dasharray:2_3]"
                value={value.thresholdDb - value.hysteresisDb}
              />
            ) : null}
            {keyed ? null : <PlotCurve fn={curve} />}
          </PlotGraph>
          {value.enabled ? (
            <PlotHandle
              aria-label="Threshold"
              getAriaValueText={describeValue}
              onValueChange={change}
              value={{ x: value.thresholdDb, y: value.thresholdDb }}
            />
          ) : null}
        </Plot>
        <DevicePanel
          className="grid-cols-4"
          device={gateDevice}
          disabled={value.enabled ? gateUnused(value.model) : OFF}
          exclude={IN_THE_TITLE_BAR}
          onValueChange={onValueChange}
          value={value}
        />
      </div>
    </DeviceFrame>
  );
}

export { GatePanel };
