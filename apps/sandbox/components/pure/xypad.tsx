"use client";

import { XYPad as XYPadPrimitive } from "@audio-ui/react";

const GRID_LINE_POSITIONS = [20, 40, 60, 80];

export function XYPad({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: XYPadPrimitive.Root.Props) {
  return (
    <XYPadPrimitive.Root {...props}>
      <XYPadPrimitive.Control
        className="relative block h-40 w-full min-w-56 cursor-crosshair touch-none select-none overflow-hidden rounded-md bg-zinc-100 shadow-inner outline-none dark:bg-zinc-800"
        data-slot="xypad"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {GRID_LINE_POSITIONS.map((position) => (
            <div
              className="absolute top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700"
              key={`v-${position}`}
              style={{ left: `${position}%` }}
            />
          ))}
          {GRID_LINE_POSITIONS.map((position) => (
            <div
              className="absolute right-0 left-0 h-px bg-zinc-200 dark:bg-zinc-700"
              key={`h-${position}`}
              style={{ top: `${position}%` }}
            />
          ))}
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-0 left-(--xy-pad-x) w-px bg-zinc-300 dark:bg-zinc-600"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-(--xy-pad-y) right-0 left-0 h-px bg-zinc-300 dark:bg-zinc-600"
        />

        <XYPadPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="pointer-events-none absolute size-5"
        >
          <div className="absolute inset-0 rounded-full bg-indigo-500 opacity-25 blur-sm" />
          <div className="absolute inset-1 rounded-full bg-indigo-500 shadow-sm" />
          <div className="absolute inset-1.5 rounded-full bg-white opacity-40" />
        </XYPadPrimitive.Thumb>

        <XYPadPrimitive.Value className="absolute top-2 right-2 rounded-md bg-white/90 px-2 py-1 font-mono text-xs text-zinc-600 shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:bg-zinc-900/90 dark:text-zinc-300" />
      </XYPadPrimitive.Control>
    </XYPadPrimitive.Root>
  );
}
