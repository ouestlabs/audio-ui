"use client";

import type { Source } from "@audio-ui/react";
import { useCallback, useEffect, useRef } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/registry/bases/base/ui/button-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { BpmControl } from "@/registry-audio/bases/base/audio/elements/bpm-control";
import {
  barsBeatsAt,
  secondsPerBeat,
  type Tempo,
} from "@/registry-audio/bases/base/lib/musical-time";

const SIGNATURES = ["4/4", "3/4", "6/8", "5/4", "7/8", "2/4"] as const;

/** One figure of the position, with its name under it. */
function PositionField({
  label,
  fieldRef,
  width,
}: {
  label: string;
  fieldRef: React.RefObject<HTMLSpanElement | null>;
  width?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex flex-col items-center leading-none", width)}
    >
      <span className="text-foreground text-xs" ref={fieldRef} />
      <span className="text-[9px] text-muted-foreground uppercase">
        {label}
      </span>
    </span>
  );
}

/**
 * The position as bars, beats and sixteenths, three labelled figures written
 * straight into the DOM as the source moves, one text node each: replacing
 * nodes on every update makes the browser recheck every :has() and :empty
 * rule on the page.
 */
function TransportPosition({
  source,
  tempo,
}: {
  source: Source<number>;
  tempo: Tempo;
}) {
  const bar = useRef<HTMLSpanElement>(null);
  const beat = useRef<HTMLSpanElement>(null);
  const sixteenth = useRef<HTMLSpanElement>(null);
  const spoken = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const targets = [bar, beat, sixteenth, spoken].map((ref) =>
      ref.current?.appendChild(document.createTextNode(""))
    );
    const [barNode, beatNode, sixteenthNode, spokenNode] = targets;
    if (!(barNode && beatNode && sixteenthNode && spokenNode)) {
      return;
    }
    const paint = () => {
      const at = barsBeatsAt(source.getSnapshot(), tempo);
      barNode.data = String(at.bar);
      beatNode.data = String(at.beat);
      sixteenthNode.data = String(at.sixteenth);
      spokenNode.data = `Bar ${at.bar}, beat ${at.beat}, sixteenth ${at.sixteenth}`;
    };
    paint();
    const unsubscribe = source.subscribe(paint);
    return () => {
      unsubscribe();
      for (const node of targets) {
        node?.remove();
      }
    };
  }, [source, tempo]);

  return (
    <time
      className="flex shrink-0 items-end gap-2 whitespace-nowrap tabular-nums"
      data-slot="transport-position"
    >
      {/* A sentence, since three bare figures would be read out as three unrelated ones. */}
      <span className="sr-only" ref={spoken} />
      <PositionField fieldRef={bar} label="Bar" width="w-8" />
      <PositionField fieldRef={beat} label="Beat" />
      <PositionField fieldRef={sixteenth} label="16th" />
    </time>
  );
}

/**
 * Two dots taking the beat in turn, rather than a picture of a metronome: they
 * tell you where the beat is from the corner of your eye. They swap on the
 * beat, written to the DOM as the source moves, with no fade, since a
 * metronome marks an instant. Parked, the first dot is lit.
 */
function MetronomeBeat({
  playing,
  source,
  tempo,
}: {
  playing: boolean;
  source: Source<number>;
  tempo: Tempo;
}) {
  const first = useRef<HTMLSpanElement>(null);
  const second = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const dots = [first.current, second.current];
    const interval = secondsPerBeat(tempo);
    let lit = -1;
    const paint = () => {
      const next = playing
        ? Math.floor(source.getSnapshot() / interval) % 2
        : 0;
      if (next === lit) {
        return;
      }
      lit = next;
      for (const [index, dot] of dots.entries()) {
        if (index === next) {
          dot?.setAttribute("data-lit", "");
        } else {
          dot?.removeAttribute("data-lit");
        }
      }
    };
    paint();
    return source.subscribe(paint);
  }, [playing, source, tempo]);

  return (
    <span aria-hidden="true" className="flex items-center gap-0.75">
      <span
        className="size-2 rounded-full border border-current data-lit:bg-current"
        ref={first}
      />
      <span
        className="size-2 rounded-full border border-current data-lit:bg-current"
        ref={second}
      />
    </span>
  );
}

/** The tempo and the time signature, joined: the pair you change together. */
function TransportTempo({
  onTempoChange,
  tempo,
}: {
  onTempoChange: (tempo: Tempo) => void;
  tempo: Tempo;
}) {
  const handleBpm = useCallback(
    (bpm: number) => onTempoChange({ ...tempo, bpm }),
    [onTempoChange, tempo]
  );
  const handleSignature = useCallback(
    (value: string | null) => {
      const [beats, unit] = String(value).split("/");
      onTempoChange({
        ...tempo,
        beatsPerBar: Number(beats),
        beatUnit: Number(unit),
      });
    },
    [onTempoChange, tempo]
  );

  return (
    <ButtonGroup className="shrink-0">
      <BpmControl onValueChange={handleBpm} value={tempo.bpm} />
      <Select
        onValueChange={handleSignature}
        value={`${tempo.beatsPerBar}/${tempo.beatUnit}`}
      >
        <SelectTrigger aria-label="Time signature" className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {SIGNATURES.map((signature) => (
              <SelectItem key={signature} value={signature}>
                {signature}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ButtonGroup>
  );
}

interface TransportProps {
  className?: string;
  /** Whether the loop is on. Leave it out, with `onLoopingChange`, for a transport without a loop. */
  looping?: boolean;
  /** Whether the metronome is on. Leave it out, with `onMetronomeChange`, for a transport without one. */
  metronome?: boolean;
  onLoopingChange?: (looping: boolean) => void;
  onMetronomeChange?: (metronome: boolean) => void;
  /** Play or pause was pressed. */
  onPlayPause: () => void;
  /** Stop was pressed. */
  onStop: () => void;
  /** The tempo or the time signature was changed. Leave it out for a fixed tempo. */
  onTempoChange?: (tempo: Tempo) => void;
  /** Whether it is playing. */
  playing: boolean;
  /** The playback position in seconds, a live value the readout follows without re-rendering. */
  source: Source<number>;
  /** The tempo and the time signature the position is counted in. */
  tempo: Tempo;
}

/**
 * The transport of a DAW as clusters joined at their seams, with the gaps
 * between clusters and never inside one: play or pause, stop and the position
 * in bars, beats and sixteenths; the loop and the metronome; the tempo and the
 * time signature. Play is the one filled button; loop and metronome are filled
 * when on (`aria-pressed`) and outlined when off, so the state is not carried
 * by color alone.
 */
function Transport({
  className,
  looping,
  metronome,
  onLoopingChange,
  onMetronomeChange,
  onPlayPause,
  onStop,
  onTempoChange,
  playing,
  source,
  tempo,
}: TransportProps) {
  const toggleLooping = useCallback(
    () => onLoopingChange?.(!looping),
    [looping, onLoopingChange]
  );
  const toggleMetronome = useCallback(
    () => onMetronomeChange?.(!metronome),
    [metronome, onMetronomeChange]
  );
  const hasClusterTwo = Boolean(onLoopingChange || onMetronomeChange);

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
      <ButtonGroup className="shrink-0">
        <Button
          aria-label={playing ? "Pause" : "Play"}
          onClick={onPlayPause}
          size="icon"
        >
          {playing ? (
            <IconPlaceholder
              hugeicons="PauseIcon"
              lucide="PauseIcon"
              phosphor="PauseIcon"
              remixicon="RiPauseFill"
              tabler="IconPlayerPauseFilled"
            />
          ) : (
            <IconPlaceholder
              hugeicons="PlayIcon"
              lucide="PlayIcon"
              phosphor="PlayIcon"
              remixicon="RiPlayFill"
              tabler="IconPlayerPlayFilled"
            />
          )}
        </Button>
        <Button
          aria-label="Stop"
          onClick={onStop}
          size="icon"
          variant="outline"
        >
          <IconPlaceholder
            hugeicons="StopIcon"
            lucide="SquareIcon"
            phosphor="StopIcon"
            remixicon="RiStopFill"
            tabler="IconPlayerStopFilled"
          />
        </Button>
        <ButtonGroupText>
          <TransportPosition source={source} tempo={tempo} />
        </ButtonGroupText>
      </ButtonGroup>
      {hasClusterTwo ? (
        <ButtonGroup className="shrink-0">
          {onLoopingChange ? (
            <Button
              aria-label="Loop"
              aria-pressed={looping}
              onClick={toggleLooping}
              size="icon"
              title="Loop"
              variant={looping ? "default" : "outline"}
            >
              <IconPlaceholder
                hugeicons="RepeatIcon"
                lucide="RepeatIcon"
                phosphor="RepeatIcon"
                remixicon="RiRepeatLine"
                tabler="IconRepeat"
              />
            </Button>
          ) : null}
          {onMetronomeChange ? (
            <Button
              aria-label="Metronome"
              aria-pressed={metronome}
              onClick={toggleMetronome}
              size="icon"
              title="Metronome"
              variant={metronome ? "default" : "outline"}
            >
              <MetronomeBeat
                playing={playing && Boolean(metronome)}
                source={source}
                tempo={tempo}
              />
            </Button>
          ) : null}
        </ButtonGroup>
      ) : null}
      {onTempoChange ? (
        <TransportTempo onTempoChange={onTempoChange} tempo={tempo} />
      ) : null}
    </div>
  );
}

export { Transport };
