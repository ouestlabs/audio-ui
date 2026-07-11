"use client";

import { XYPad as XYPadPrimitive } from "@audio-ui/react";

export function XYPad(props: XYPadPrimitive.RootProps) {
  return (
    <XYPadPrimitive.Root {...props}>
      <XYPadPrimitive.Label />
      <XYPadPrimitive.Slider
        className="relative block h-40 w-full min-w-56 cursor-crosshair touch-none select-none overflow-hidden rounded-md bg-zinc-100 shadow-inner outline-none dark:bg-zinc-800"
        data-slot="xypad"
      >
        <XYPadPrimitive.Grid className="pointer-events-none absolute inset-0">
          {Array.from({ length: 4 }, (_, i) => {
            const position = ((i + 1) * 100) / 5;
            return (
              <XYPadPrimitive.GridLine
                className="absolute top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700"
                key={`v-${position}`}
                orientation="vertical"
                position={position}
              />
            );
          })}
          {Array.from({ length: 4 }, (_, i) => {
            const position = ((i + 1) * 100) / 5;
            return (
              <XYPadPrimitive.GridLine
                className="absolute right-0 left-0 h-px bg-zinc-200 dark:bg-zinc-700"
                key={`h-${position}`}
                orientation="horizontal"
                position={position}
              />
            );
          })}
        </XYPadPrimitive.Grid>

        <XYPadPrimitive.Crosshair
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-zinc-300 dark:bg-zinc-600"
          orientation="vertical"
        />
        <XYPadPrimitive.Crosshair
          className="pointer-events-none absolute right-0 left-0 h-px bg-zinc-300 dark:bg-zinc-600"
          orientation="horizontal"
        />

        <XYPadPrimitive.Cursor className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute size-5 transition-none">
          <XYPadPrimitive.CursorGlow className="absolute inset-0 rounded-full bg-indigo-500 opacity-25 blur-sm" />
          <XYPadPrimitive.CursorDot className="absolute inset-1 rounded-full bg-indigo-500 shadow-sm" />
          <XYPadPrimitive.CursorHighlight className="absolute inset-1.5 rounded-full bg-white opacity-40" />
        </XYPadPrimitive.Cursor>

        <XYPadPrimitive.ValueDisplay className="absolute top-2 right-2 rounded-md bg-white/90 px-2 py-1 font-mono text-xs text-zinc-600 shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:bg-zinc-900/90 dark:text-zinc-300" />
      </XYPadPrimitive.Slider>
    </XYPadPrimitive.Root>
  );
}
