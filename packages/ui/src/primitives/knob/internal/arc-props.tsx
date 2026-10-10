import type * as React from "react";
import { ARC_OUTER_RADIUS, arcPath } from "./shared";

export function useArcProps(
  strokeWidth: number,
  from: number,
  to: number
): React.SVGProps<SVGSVGElement> {
  const hasArc = Math.abs(to - from) > 0.001;
  return {
    "aria-hidden": true,
    children: hasArc ? (
      <path
        d={arcPath(ARC_OUTER_RADIUS - strokeWidth / 2, from, to)}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    ) : null,
    viewBox: "0 0 48 48",
  };
}
