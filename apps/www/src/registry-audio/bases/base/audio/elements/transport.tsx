"use client";

import { type Source, Timeline as TimelinePrimitive } from "@audio-ui/react";
import { useCallback, useEffect, useRef } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";

/** 75 as "1:15", 3725 as "1:02:05". */
function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}

/** The position as a clock, written straight into the DOM as the source moves. */
function TransportTime({
  className,
  source,
}: {
  className?: string;
  source: Source<number>;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const paint = () => {
      node.textContent = formatClock(source.getSnapshot());
    };
    paint();
    return source.subscribe(paint);
  }, [source]);
  return (
    <span
      className={cn("min-w-10 tabular-nums", className)}
      data-slot="transport-time"
      ref={ref}
    />
  );
}

interface TransportProps {
  "aria-label"?: string;
  className?: string;
  /** Length of the track, in seconds. */
  duration: number;
  /** Called when the play button is pressed, with whether playback should now run. */
  onPlayingChange: (playing: boolean) => void;
  /** Called when the bar is pressed, dragged or moved by key, with the new position in seconds. */
  onSeek?: (seconds: number) => void;
  /** Whether it is playing: the button shows pause. */
  playing: boolean;
  /** The playback position in seconds, a live value: the bar and the clock follow it without re-rendering. */
  source: Source<number>;
}

/**
 * Play or pause, the position, a bar to seek on, and the length: the controls
 * under a player or an editor. The bar is a `Timeline` ruler, so a press jumps
 * to the pointer, a drag scrubs (four times finer with Shift), and the arrow
 * keys, Page Up/Down, Home and End move it.
 */
function Transport({
  "aria-label": ariaLabel = "Playback position",
  className,
  duration,
  onPlayingChange,
  onSeek,
  playing,
  source,
}: TransportProps) {
  const toggle = useCallback(
    () => onPlayingChange(!playing),
    [onPlayingChange, playing]
  );
  return (
    <div
      className={cn("flex w-full min-w-0 items-center gap-3", className)}
      data-slot="transport"
      role="group"
    >
      <Button
        aria-label={playing ? "Pause" : "Play"}
        onClick={toggle}
        size="icon"
        variant="outline"
      >
        <IconPlaceholder
          hugeicons={playing ? "PauseIcon" : "PlayIcon"}
          lucide={playing ? "PauseIcon" : "PlayIcon"}
          phosphor={playing ? "PauseIcon" : "PlayIcon"}
          remixicon={playing ? "RiPauseLine" : "RiPlayLine"}
          tabler={playing ? "IconPlayerPause" : "IconPlayerPlay"}
        />
      </Button>
      <TransportTime
        className="text-right text-muted-foreground text-xs"
        source={source}
      />
      <TimelinePrimitive.Root
        className="min-w-0 flex-1"
        duration={duration}
        onPositionChange={onSeek}
        source={source}
        step={1}
      >
        <TimelinePrimitive.Ruler
          aria-label={ariaLabel}
          className="cn-transport-track relative h-1.5 cursor-pointer touch-none"
          getAriaValueText={formatClock}
        >
          <TimelinePrimitive.Playhead
            className="cn-transport-fill pointer-events-none absolute inset-y-0"
            style={{
              left: 0,
              width: "calc(var(--timeline-unit) * var(--timeline-offset))",
            }}
          />
          <TimelinePrimitive.Playhead className="cn-transport-thumb pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2" />
        </TimelinePrimitive.Ruler>
      </TimelinePrimitive.Root>
      <span className="min-w-10 text-muted-foreground text-xs tabular-nums">
        {formatClock(duration)}
      </span>
    </div>
  );
}

export { formatClock, Transport };
