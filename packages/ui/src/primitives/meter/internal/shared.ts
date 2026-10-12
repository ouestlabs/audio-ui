import type { MeterOrientation } from "@audio-ui/core/meter";
import type * as React from "react";

export function indicatorStyle(
  orientation: MeterOrientation,
  percent: number
): React.CSSProperties {
  return orientation === "horizontal"
    ? {
        height: "100%",
        transform: `scaleX(${percent})`,
        transformOrigin: "left center",
        width: "100%",
        willChange: "transform",
      }
    : {
        height: "100%",
        transform: `scaleY(${percent})`,
        transformOrigin: "center bottom",
        width: "100%",
        willChange: "transform",
      };
}
