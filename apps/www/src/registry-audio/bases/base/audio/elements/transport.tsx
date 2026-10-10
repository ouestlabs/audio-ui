"use client";

import type { Source } from "@audio-ui/react";
import { type ComponentProps, useCallback, useEffect, useRef } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { BpmControl } from "@/registry-audio/bases/base/audio/elements/bpm-control";
import {
  barsBeatsAt,
  type Tempo,
} from "@/registry-audio/bases/base/lib/musical-time";

type ButtonProps = ComponentProps<typeof Button>;

/** "012.3.2": bar, beat and sixteenth, the way a DAW writes its position. */
function formatPosition(seconds: number, tempo: Tempo): string {
  const { bar, beat, sixteenth } = barsBeatsAt(seconds, tempo);
  return `${String(bar).padStart(3, "0")}.${beat}.${sixteenth}`;
}

/** The position in bars, beats and sixteenths, written straight into the DOM as the source moves. */
function TransportPosition({
  source,
  tempo,
}: {
  source: Source<number>;
  tempo: Tempo;
}) {
  const ref = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const paint = () => {
      node.textContent = formatPosition(source.getSnapshot(), tempo);
    };
    paint();
    return source.subscribe(paint);
  }, [source, tempo]);
  return (
    <output
      aria-label="Position in bars, beats and sixteenths"
      className="cn-transport-position min-w-20 text-center font-mono tabular-nums"
      data-slot="transport-position"
      ref={ref}
    />
  );
}

function TransportButton({
  className,
  label,
  pressed,
  ...props
}: Omit<ButtonProps, "aria-label" | "aria-pressed"> & {
  label: string;
  /** Leave it out for a button that acts; set it for one that stays on. */
  pressed?: boolean;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={pressed}
      className={cn("cn-transport-button", className)}
      size="icon"
      title={label}
      variant="outline"
      {...props}
    />
  );
}

interface TransportProps {
  /** The tempo in beats per minute. */
  bpm: number;
  className?: string;
  /** Whether the loop is on. */
  looping: boolean;
  onBpmChange: (bpm: number) => void;
  onLoopingChange: (looping: boolean) => void;
  /** Play was pressed. */
  onPlay: () => void;
  onRecordingChange: (recording: boolean) => void;
  /** Return to start was pressed: go back to the top. */
  onReturn: () => void;
  /** Stop was pressed: stop, and keep the position for you to decide. */
  onStop: () => void;
  /** Whether it is playing. */
  playing: boolean;
  /** Whether it is armed to record. */
  recording: boolean;
  /** The playback position in seconds, a live value the readout follows without re-rendering. */
  source: Source<number>;
  /** Time signature, with `bpm` it is how the position is counted. @default 4/4 */
  tempo?: Omit<Tempo, "bpm">;
}

const FOUR_FOUR = { beatsPerBar: 4, beatUnit: 4 };

/**
 * The transport of a DAW: return to start, play, stop, record and loop, the
 * position in bars and beats, and the tempo. The buttons that stay on (play,
 * record, loop) are toggle buttons (`aria-pressed`); the position follows a
 * live source without re-rendering.
 */
function Transport({
  bpm,
  className,
  looping,
  onBpmChange,
  onLoopingChange,
  onPlay,
  onRecordingChange,
  onReturn,
  onStop,
  playing,
  recording,
  source,
  tempo = FOUR_FOUR,
}: TransportProps) {
  const counted = { ...tempo, bpm };
  const toggleRecording = useCallback(
    () => onRecordingChange(!recording),
    [onRecordingChange, recording]
  );
  const toggleLooping = useCallback(
    () => onLoopingChange(!looping),
    [looping, onLoopingChange]
  );
  return (
    <div
      aria-label="Transport"
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-2",
        className
      )}
      data-slot="transport"
      role="group"
    >
      <TransportButton label="Return to start" onClick={onReturn}>
        <IconPlaceholder
          hugeicons="PreviousIcon"
          lucide="SkipBackIcon"
          phosphor="SkipBackIcon"
          remixicon="RiSkipBackLine"
          tabler="IconPlayerSkipBack"
        />
      </TransportButton>
      <TransportButton label="Play" onClick={onPlay} pressed={playing}>
        <IconPlaceholder
          hugeicons="PlayIcon"
          lucide="PlayIcon"
          phosphor="PlayIcon"
          remixicon="RiPlayLine"
          tabler="IconPlayerPlay"
        />
      </TransportButton>
      <TransportButton label="Stop" onClick={onStop}>
        <IconPlaceholder
          hugeicons="StopIcon"
          lucide="SquareIcon"
          phosphor="StopIcon"
          remixicon="RiStopLine"
          tabler="IconPlayerStop"
        />
      </TransportButton>
      <TransportButton
        className="cn-transport-record"
        label="Record"
        onClick={toggleRecording}
        pressed={recording}
      >
        <IconPlaceholder
          hugeicons="RecordIcon"
          lucide="CircleIcon"
          phosphor="RecordIcon"
          remixicon="RiRecordCircleLine"
          tabler="IconPlayerRecord"
        />
      </TransportButton>
      <TransportButton label="Loop" onClick={toggleLooping} pressed={looping}>
        <IconPlaceholder
          hugeicons="RepeatIcon"
          lucide="RepeatIcon"
          phosphor="RepeatIcon"
          remixicon="RiRepeatLine"
          tabler="IconRepeat"
        />
      </TransportButton>
      <TransportPosition source={source} tempo={counted} />
      <BpmControl onValueChange={onBpmChange} value={bpm} />
    </div>
  );
}

export { formatPosition, Transport };
