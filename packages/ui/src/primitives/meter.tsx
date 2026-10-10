import * as React from "react";
import type { Nullable } from "../utils";
import { clampUnit, panic } from "../utils";
import { getDataAttributes } from "./internal/data-attributes";

export namespace Meter {
  interface ConfigContextValue {
    ariaLabel?: string;
    ariaLabelledBy?: string;
    clipThreshold: number;
    max: number;
    min: number;
    orientation: "horizontal" | "vertical";
  }

  /** Split from config: changes every sample frame, so only components that render live levels subscribe to it. */
  interface ValueContextValue {
    peak?: number[];
    value: number[];
  }

  const ConfigContext = React.createContext<ConfigContextValue | null>(null);
  const ValueContext = React.createContext<ValueContextValue | null>(null);
  const ChannelIndexContext = React.createContext<Nullable<number>>(null);

  function useConfigContext() {
    const context = React.useContext(ConfigContext);
    if (!context) {
      panic("Meter components must be used within Meter.Root");
    }
    return context;
  }

  function useValueContext() {
    const context = React.useContext(ValueContext);
    if (!context) {
      panic("Meter components must be used within Meter.Root");
    }
    return context;
  }

  function useChannelIndex() {
    const index = React.useContext(ChannelIndexContext);
    if (index === null) {
      panic("Meter channel parts must be used within Meter.Channel");
    }
    return index;
  }

  export interface RootProps
    extends Omit<React.ComponentProps<"div">, "onChange"> {
    "aria-label"?: string;
    "aria-labelledby"?: string;
    /** Level (in dB) at or above which a channel is considered clipping. */
    clipThreshold?: number;
    max?: number;
    min?: number;
    orientation?: "horizontal" | "vertical";
    /** Peak-hold level per channel (in dB). Timing/decay live outside the primitive. */
    peak?: number[];
    /** Instant level per channel (in dB). Array length is the channel count. */
    value: number[];
  }

  export function Root({
    value,
    peak,
    min = -60,
    max = 6,
    clipThreshold = 0,
    orientation = "vertical",
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    className,
    children,
    ...props
  }: RootProps) {
    const configValue = React.useMemo<ConfigContextValue>(
      () => ({
        ariaLabel,
        ariaLabelledBy,
        clipThreshold,
        max,
        min,
        orientation,
      }),
      [ariaLabel, ariaLabelledBy, clipThreshold, max, min, orientation]
    );

    const valueContextValue = React.useMemo<ValueContextValue>(
      () => ({ peak, value }),
      [peak, value]
    );

    return (
      <ConfigContext.Provider value={configValue}>
        <ValueContext.Provider value={valueContextValue}>
          <div
            aria-label={ariaLabel || (ariaLabelledBy ? undefined : "Meter")}
            aria-labelledby={ariaLabelledBy}
            className={className}
            {...getDataAttributes("meter", {
              orientation,
              part: "meter-wrapper",
            })}
            role="group"
            {...props}
          >
            {children}
          </div>
        </ValueContext.Provider>
      </ConfigContext.Provider>
    );
  }

  export interface ChannelsProps {
    children: (value: number, index: number) => React.ReactNode;
  }

  export function Channels({ children }: ChannelsProps) {
    const { value } = useValueContext();
    return (
      <>{value.map((channelValue, index) => children(channelValue, index))}</>
    );
  }

  export interface ChannelProps extends React.ComponentProps<"div"> {
    index: number;
  }

  export function Channel({
    index,
    className,
    children,
    ...props
  }: ChannelProps) {
    const { ariaLabel, ariaLabelledBy, clipThreshold, max, min, orientation } =
      useConfigContext();
    const { value } = useValueContext();
    const channelValue = value[index] ?? min;
    const isClipping = channelValue >= clipThreshold;

    return (
      <ChannelIndexContext.Provider value={index}>
        <div
          aria-label={
            ariaLabel ? `${ariaLabel} ${index + 1}` : `Channel ${index + 1}`
          }
          aria-labelledby={ariaLabelledBy}
          aria-valuemax={max}
          aria-valuemin={min}
          aria-valuenow={channelValue}
          className={className}
          {...getDataAttributes("meter", {
            clip: isClipping,
            orientation,
            part: "channel",
          })}
          role="meter"
          {...props}
        >
          {children}
        </div>
      </ChannelIndexContext.Provider>
    );
  }

  export interface FillProps extends React.ComponentProps<"div"> {}

  export function Fill({ className, style, ...props }: FillProps) {
    const { clipThreshold, max, min, orientation } = useConfigContext();
    const { value } = useValueContext();
    const index = useChannelIndex();
    const channelValue = value[index] ?? min;
    const percentage = clampUnit((channelValue - min) / (max - min || 1));
    const isClipping = channelValue >= clipThreshold;

    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("meter", {
          clip: isClipping,
          orientation,
          part: "fill",
        })}
        style={{
          ...(orientation === "horizontal"
            ? {
                height: "100%",
                transform: `scaleX(${percentage})`,
                transformOrigin: "left center",
                width: "100%",
                willChange: "transform",
              }
            : {
                height: "100%",
                transform: `scaleY(${percentage})`,
                transformOrigin: "center bottom",
                width: "100%",
                willChange: "transform",
              }),
          ...style,
        }}
        {...props}
      />
    );
  }

  export interface PeakProps extends React.ComponentProps<"div"> {}

  export function Peak({ className, style, ...props }: PeakProps) {
    const { max, min, orientation } = useConfigContext();
    const { peak } = useValueContext();
    const index = useChannelIndex();
    const peakValue = peak?.[index];

    if (peakValue === undefined) {
      return null;
    }

    const percentage = clampUnit((peakValue - min) / (max - min || 1));

    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("meter", { orientation, part: "peak" })}
        style={{
          ...(orientation === "horizontal"
            ? { left: `${percentage * 100}%` }
            : { bottom: `${percentage * 100}%` }),
          ...style,
        }}
        {...props}
      />
    );
  }

  export interface ValueDisplayProps
    extends Omit<React.ComponentProps<"div">, "children"> {
    formatValue?: (value: number) => React.ReactNode;
  }

  export function ValueDisplay({
    className,
    formatValue,
    ...props
  }: ValueDisplayProps) {
    const { min } = useConfigContext();
    const { value } = useValueContext();
    const index = useChannelIndex();
    const channelValue = value[index] ?? min;

    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("meter", { part: "value-display" })}
        {...props}
      >
        {formatValue ? formatValue(channelValue) : channelValue.toFixed(1)}
      </div>
    );
  }
}
