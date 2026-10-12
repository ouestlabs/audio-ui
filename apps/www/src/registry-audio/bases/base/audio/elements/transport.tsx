"use client";

import type { Source } from "@audio-ui/react";
import { Toolbar } from "@base-ui/react/toolbar";
import { useCallback, useEffect, useRef } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/registry/bases/base/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
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
  gridLabel,
  METRONOME_RHYTHMS,
  type MetronomeRhythm,
  metronomeRhythmSeconds,
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
  rhythm,
  source,
  tempo,
}: {
  playing: boolean;
  rhythm: MetronomeRhythm;
  source: Source<number>;
  tempo: Tempo;
}) {
  const first = useRef<HTMLSpanElement>(null);
  const second = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const dots = [first.current, second.current];
    // The dots swap on the click's rhythm, so they and the sound are one pulse.
    const interval =
      metronomeRhythmSeconds(rhythm, tempo) ?? secondsPerBeat(tempo);
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
  }, [playing, rhythm, source, tempo]);

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

interface MetronomeSound {
  label: string;
  value: string;
}

/**
 * The click's settings behind a caret beside the metronome toggle, never in
 * the way of it. Rhythm names come from the interval each one works out to,
 * through the same `gridLabel` the timeline's grid uses, so "1/8T" means one
 * thing everywhere.
 */
function MetronomeMenu({
  onRhythmChange,
  onSoundChange,
  rhythm,
  sound,
  sounds,
  tempo,
}: {
  onRhythmChange?: (rhythm: MetronomeRhythm) => void;
  onSoundChange?: (sound: string) => void;
  rhythm: MetronomeRhythm;
  sound?: string;
  sounds?: readonly MetronomeSound[];
  tempo: Tempo;
}) {
  const handleRhythm = useCallback(
    (value: string) => onRhythmChange?.(value as MetronomeRhythm),
    [onRhythmChange]
  );
  const handleSound = useCallback(
    (value: string) => onSoundChange?.(value),
    [onSoundChange]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Toolbar.Button
            aria-label="Metronome settings"
            className="hidden @2xl/transport:flex"
            render={<Button size="icon" variant="outline" />}
          />
        }
      >
        <IconPlaceholder
          hugeicons="ArrowDown01Icon"
          lucide="ChevronDownIcon"
          phosphor="CaretDownIcon"
          remixicon="RiArrowDownSLine"
          tabler="IconChevronDown"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        {sounds && onSoundChange ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sound</DropdownMenuLabel>
              <DropdownMenuRadioGroup onValueChange={handleSound} value={sound}>
                {sounds.map((item) => (
                  <DropdownMenuRadioItem key={item.value} value={item.value}>
                    {item.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            {onRhythmChange ? <DropdownMenuSeparator /> : null}
          </>
        ) : null}
        {onRhythmChange ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Rhythm</DropdownMenuLabel>
            <DropdownMenuRadioGroup onValueChange={handleRhythm} value={rhythm}>
              {METRONOME_RHYTHMS.map((item) => {
                const seconds = metronomeRhythmSeconds(item.id, tempo);
                return (
                  <DropdownMenuRadioItem
                    className="tabular-nums"
                    key={item.id}
                    value={item.id}
                  >
                    {seconds === null ? "Auto" : gridLabel(seconds, tempo)}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The tempo and the time signature, joined: the pair you change together. */
function TransportTempo({
  looping,
  metronome,
  onLoopingChange,
  onMetronomeChange,
  onRhythmChange,
  onTempoChange,
  rhythm,
  tempo,
}: {
  looping?: boolean;
  metronome?: boolean;
  onLoopingChange?: (on: boolean) => void;
  onMetronomeChange?: (on: boolean) => void;
  onRhythmChange?: (rhythm: MetronomeRhythm) => void;
  onTempoChange: (tempo: Tempo) => void;
  rhythm: MetronomeRhythm;
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

  const signature = `${tempo.beatsPerBar}/${tempo.beatUnit}`;
  const handleRhythm = useCallback(
    (value: string) => onRhythmChange?.(value as MetronomeRhythm),
    [onRhythmChange]
  );
  // Wide, the tempo sits in the bar. Narrow, only the BPM shows, and a click opens the full setting.
  return (
    <>
      <Toolbar.Group
        className="hidden @2xl/transport:flex"
        render={<ButtonGroup className="shrink-0" />}
      >
        <BpmControl onValueChange={handleBpm} value={tempo.bpm} />
        <Select onValueChange={handleSignature} value={signature}>
          <SelectTrigger
            aria-label="Time signature"
            className="w-20"
            render={<Toolbar.Button />}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SIGNATURES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Toolbar.Group>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Tempo: ${tempo.bpm} BPM, ${signature}`}
              className="@2xl/transport:hidden tabular-nums"
              variant="outline"
            />
          }
        >
          {tempo.bpm}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto min-w-36">
          <div className="p-2">
            <BpmControl
              className="w-full"
              onValueChange={handleBpm}
              value={tempo.bpm}
            />
          </div>
          {onLoopingChange ? (
            <DropdownMenuCheckboxItem
              checked={Boolean(looping)}
              onCheckedChange={onLoopingChange}
            >
              Loop
            </DropdownMenuCheckboxItem>
          ) : null}
          {onMetronomeChange ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Metronome</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-auto min-w-48">
                <DropdownMenuCheckboxItem
                  checked={Boolean(metronome)}
                  onCheckedChange={onMetronomeChange}
                >
                  On
                </DropdownMenuCheckboxItem>
                {onRhythmChange ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Rhythm</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        onValueChange={handleRhythm}
                        value={rhythm}
                      >
                        {METRONOME_RHYTHMS.map((item) => {
                          const seconds = metronomeRhythmSeconds(
                            item.id,
                            tempo
                          );
                          return (
                            <DropdownMenuRadioItem
                              className="tabular-nums"
                              key={item.id}
                              value={item.id}
                            >
                              {seconds === null
                                ? "Auto"
                                : gridLabel(seconds, tempo)}
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </>
                ) : null}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            onValueChange={handleSignature}
            value={signature}
          >
            {SIGNATURES.map((item) => (
              <DropdownMenuRadioItem key={item} value={item}>
                {item}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
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
  /** The click's rhythm was picked. Leave it out, with `onSoundChange`, for a metronome without settings. */
  onRhythmChange?: (rhythm: MetronomeRhythm) => void;
  /** The click's sound was picked, one of `sounds`. */
  onSoundChange?: (sound: string) => void;
  /** Stop was pressed. */
  onStop: () => void;
  /** The tempo or the time signature was changed. Leave it out for a fixed tempo. */
  onTempoChange?: (tempo: Tempo) => void;
  /** Whether it is playing. */
  playing: boolean;
  /** How often the click sounds, and what the metronome's dots follow. @default "auto" */
  rhythm?: MetronomeRhythm;
  /** The picked sound, one of `sounds`'s values. */
  sound?: string;
  /** The sounds the click can have: the menu lists them when `onSoundChange` is given. */
  sounds?: readonly MetronomeSound[];
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
  onRhythmChange,
  onSoundChange,
  onStop,
  onTempoChange,
  playing,
  rhythm = "auto",
  sound,
  sounds,
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
    <Toolbar.Root
      aria-label="Transport"
      className={cn(
        "@container/transport flex w-full min-w-0 flex-wrap items-center gap-2",
        className
      )}
      data-slot="transport"
    >
      <Toolbar.Group render={<ButtonGroup className="shrink-0" />}>
        <Toolbar.Button
          aria-label={playing ? "Pause" : "Play"}
          onClick={onPlayPause}
          render={<Button size="icon" />}
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
        </Toolbar.Button>
        <Toolbar.Button
          aria-label="Stop"
          onClick={onStop}
          render={<Button size="icon" variant="outline" />}
        >
          <IconPlaceholder
            hugeicons="StopIcon"
            lucide="SquareIcon"
            phosphor="StopIcon"
            remixicon="RiStopFill"
            tabler="IconPlayerStopFilled"
          />
        </Toolbar.Button>
        <ButtonGroupText>
          <TransportPosition source={source} tempo={tempo} />
        </ButtonGroupText>
      </Toolbar.Group>
      {hasClusterTwo ? (
        <Toolbar.Group render={<ButtonGroup className="shrink-0" />}>
          {onLoopingChange ? (
            <Toolbar.Button
              aria-label="Loop"
              aria-pressed={looping}
              className="hidden @2xl/transport:flex"
              onClick={toggleLooping}
              render={
                <Button size="icon" variant={looping ? "default" : "outline"} />
              }
              title="Loop"
            >
              <IconPlaceholder
                hugeicons="RepeatIcon"
                lucide="RepeatIcon"
                phosphor="RepeatIcon"
                remixicon="RiRepeatLine"
                tabler="IconRepeat"
              />
            </Toolbar.Button>
          ) : null}
          {onMetronomeChange ? (
            <Toolbar.Button
              aria-label="Metronome"
              aria-pressed={metronome}
              className="hidden @2xl/transport:flex"
              onClick={toggleMetronome}
              render={
                <Button
                  size="icon"
                  variant={metronome ? "default" : "outline"}
                />
              }
              title="Metronome"
            >
              <MetronomeBeat
                playing={playing && Boolean(metronome)}
                rhythm={rhythm}
                source={source}
                tempo={tempo}
              />
            </Toolbar.Button>
          ) : null}
          {onMetronomeChange && (onRhythmChange || onSoundChange) ? (
            <MetronomeMenu
              onRhythmChange={onRhythmChange}
              onSoundChange={onSoundChange}
              rhythm={rhythm}
              sound={sound}
              sounds={sounds}
              tempo={tempo}
            />
          ) : null}
        </Toolbar.Group>
      ) : null}
      {onTempoChange ? (
        <TransportTempo
          looping={looping}
          metronome={metronome}
          onLoopingChange={onLoopingChange}
          onMetronomeChange={onMetronomeChange}
          onRhythmChange={onRhythmChange}
          onTempoChange={onTempoChange}
          rhythm={rhythm}
          tempo={tempo}
        />
      ) : null}
    </Toolbar.Root>
  );
}

export { Transport };
