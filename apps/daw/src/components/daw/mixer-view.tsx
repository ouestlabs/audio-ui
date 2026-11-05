import { dbToGain, gainToDb, peakDb } from "@audio-ui/core/analysis";
import type { Meter as MeterPrimitive, Source } from "@audio-ui/react";
import { useCallback, useEffect, useRef } from "react";
import { Fader } from "@/components/audio-ui/fader";
import { Knob } from "@/components/audio-ui/knob";
import { Meter } from "@/components/audio-ui/meter";
import { TRACK_COLORS } from "@/components/audio-ui/timeline";
import { Toggle } from "@/components/ui/toggle";
import type { useArrangement } from "@/hooks/use-arrangement";
import type { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import { useAudioLevels } from "@/hooks/use-audio-levels";
import {
  type AutomationFollowing,
  useAutomatedMix,
} from "@/hooks/use-track-automation";
import type {
  ArrangementTrack,
  AutomatedParameter,
  Mix,
} from "@/lib/arrangement";
import { trackOf } from "@/lib/arrangement-state";
import { cn } from "@/lib/utils";

type Arrangement = ReturnType<typeof useArrangement>;
type Engine = ReturnType<typeof useArrangementEngine>;

/** The fader's floor: at it, the channel is silent (MIX-002). */
const MIN_DB = -60;
const MAX_DB = 6;
const NO_ANALYSERS: readonly AnalyserNode[] = [];
const SILENT: MeterPrimitive.Root.Frame = {
  levels: [-100, -100],
  peaks: [-100, -100],
};
const SILENT_SOURCE = {
  getSnapshot: () => SILENT,
  subscribe: () => () => undefined,
};

const decibels = (gain: number) => Math.max(MIN_DB, gainToDb(gain));
const gainOf = (db: number) => (db <= MIN_DB ? 0 : dbToGain(db));
const formatDb = (db: number) =>
  db <= MIN_DB ? "-∞" : `${db > 0 ? "+" : ""}${db.toFixed(1)}`;
const formatPan = (pan: number) => {
  const amount = Math.round(Math.abs(pan) * 50);
  if (amount === 0) {
    return "C";
  }
  return `${amount}${pan < 0 ? "L" : "R"}`;
};
const formatSend = (level: number) =>
  level <= 0 ? "-∞ dB" : `${gainToDb(level).toFixed(1)} dB`;

/** The main track's meter is read to the dB: a scale beside it. */
const MAIN_MARKS = [0, -6, -12, -24, -48];

function StripMeter({
  label,
  levels,
  marks,
}: {
  label: string;
  levels: Source<MeterPrimitive.Root.Frame>;
  marks?: readonly number[];
}) {
  return (
    <Meter
      aria-label={`${label} level`}
      // The scale hangs off its right edge, outside the pair it would push off the channel's middle.
      className="data-[orientation=vertical]:me-0 data-[orientation=vertical]:h-full"
      marks={marks}
      size="sm"
      source={levels}
      warnThreshold={-12}
    />
  );
}

/**
 * The loudest sample the main track has played since it was last cleared, in
 * dB (MIX-011), red once one went over 0 dBFS; a click clears it. Read from
 * the channel's analysers each frame, and written straight into the page when
 * it rises, so it costs no render.
 */
function PeakReadout({ analysers }: { analysers: readonly AnalyserNode[] }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const held = useRef(Number.NEGATIVE_INFINITY);
  const paint = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const text = formatDb(held.current);
    button.textContent = text;
    button.ariaLabel = `Main peak ${text} dB, click to clear`;
    button.toggleAttribute("data-over", held.current >= 0);
  }, []);
  useEffect(() => {
    const read = analysers.map((analyser) => ({
      analyser,
      buffer: new Float32Array(analyser.fftSize),
    }));
    let frame = 0;
    const tick = () => {
      for (const { analyser, buffer } of read) {
        analyser.getFloatTimeDomainData(buffer);
        const loudest = peakDb(buffer);
        if (loudest > held.current) {
          held.current = loudest;
          paint();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [analysers, paint]);
  const clear = useCallback(() => {
    held.current = Number.NEGATIVE_INFINITY;
    paint();
  }, [paint]);
  return (
    <button
      aria-label="Main peak -∞ dB, click to clear"
      className="row-start-6 h-7 w-full rounded-md border text-muted-foreground text-xs tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-over:border-destructive data-over:bg-destructive/10 data-over:text-destructive"
      onClick={clear}
      ref={buttonRef}
      type="button"
    >
      -∞
    </button>
  );
}

/** A send of a channel to a return, from silence to 0 dB (MIX-007). */
function SendKnob({
  back,
  onSend,
  onSettle,
  track,
}: {
  back: ArrangementTrack;
  onSend: (id: string, to: string, level: number) => void;
  onSettle: () => void;
  track: ArrangementTrack;
}) {
  const change = useCallback(
    (level: number) => onSend(track.id, back.id, level),
    [back.id, onSend, track.id]
  );
  return (
    <Knob
      aria-label={`${track.name} send to ${back.name}`}
      formatValue={formatSend}
      max={1}
      min={0}
      onValueChange={change}
      onValueCommitted={onSettle}
      size="sm"
      step={0.01}
      value={track.sends?.[back.id] ?? 0}
      valueLabel="hidden"
    />
  );
}

interface StripProps {
  analysers: readonly AnalyserNode[] | null;
  /** What the fader and the pan follow their envelopes by (AUT-006). */
  following: AutomationFollowing;
  /** The group the track plays into, when it is in one (MIX-020). */
  into?: string;
  /** Main has no switch, no solo and no sends. */
  main?: boolean;
  onMix: (id: string, patch: Partial<Omit<Mix, "color">>) => void;
  onSelect: (id: string) => void;
  onSend: (id: string, to: string, level: number) => void;
  onSettle: () => void;
  returns: readonly ArrangementTrack[];
  selected: boolean;
  /** A return's own sends are off (MIX-008): it shows none. */
  sends?: boolean;
  track: ArrangementTrack;
}

/** A channel of the mixer: its sends, its pan, its fader and meter, its switch and solo. */
function Strip({
  analysers,
  following,
  into,
  main,
  onMix,
  onSelect,
  onSend,
  onSettle,
  returns,
  selected,
  sends,
  track,
}: StripProps) {
  const mix = useAutomatedMix(track, following);
  const setGain = useCallback(
    (volume: number) => onMix(track.id, { gain: gainOf(volume) }),
    [onMix, track.id]
  );
  const setPan = useCallback(
    (pan: number) => onMix(track.id, { pan }),
    [onMix, track.id]
  );
  const setOn = useCallback(
    (on: boolean) => onMix(track.id, { muted: !on }),
    [onMix, track.id]
  );
  const setSolo = useCallback(
    (soloed: boolean) => onMix(track.id, { soloed }),
    [onMix, track.id]
  );
  const select = useCallback(() => onSelect(track.id), [onSelect, track.id]);
  const db = decibels(mix.gain);
  const levels = useAudioLevels(analysers ?? NO_ANALYSERS);
  const source = analysers ? levels : SILENT_SOURCE;
  return (
    <section
      aria-label={track.name}
      className={cn(
        // A column of the console, a hairline between it and the next.
        "row-span-6 grid w-28 grid-rows-subgrid justify-items-center border-border/60 border-e px-2 pb-3 transition-colors",
        // The main track is wider, its meter has a scale; it stays at the right edge while the channels scroll under it.
        main && "sticky end-0 z-10 ms-2 w-36 border-s border-e-0 bg-background",
        track.kind === "group" && "bg-muted/40",
        selected && "bg-muted"
      )}
      onPointerDown={select}
    >
      <div className="row-start-1 flex w-full min-w-0 flex-col items-center gap-1.5">
        {/* The track's color, as its clips have it. */}
        <span
          aria-hidden="true"
          className={cn(
            "h-1 w-full rounded-b-sm",
            main ? "bg-foreground/25" : TRACK_COLORS[mix.color]?.dot
          )}
        />
        <span className="min-h-4 w-full truncate text-center font-medium text-xs">
          {track.name}
        </span>
        {into ? (
          <span className="w-full truncate text-center text-muted-foreground text-xs">
            To {into}
          </span>
        ) : null}
      </div>
      {sends ? (
        <div
          aria-label={`${track.name} sends`}
          className="row-start-2 flex flex-wrap justify-center gap-1"
          role="group"
        >
          {returns.map((back) => (
            <SendKnob
              back={back}
              key={back.id}
              onSend={onSend}
              onSettle={onSettle}
              track={track}
            />
          ))}
        </div>
      ) : null}
      <Knob
        anchor={0}
        aria-label={`${track.name} pan`}
        className="row-start-3"
        formatValue={formatPan}
        max={1}
        min={-1}
        onValueChange={setPan}
        onValueCommitted={onSettle}
        size="sm"
        step={0.02}
        value={mix.pan}
        valueLabel="hidden"
      />
      <div className="row-start-4 flex min-h-0 justify-center gap-1.5">
        <Fader
          aria-label={`${track.name} volume`}
          formatValue={formatDb}
          largeStep={6}
          max={MAX_DB}
          min={MIN_DB}
          onValueChange={setGain}
          onValueCommitted={onSettle}
          size="sm"
          step={0.5}
          value={db}
          valueLabel="hidden"
        />
        <StripMeter
          label={track.name}
          levels={source}
          marks={main ? MAIN_MARKS : undefined}
        />
      </div>
      <span
        aria-hidden="true"
        className="row-start-5 text-muted-foreground text-xs tabular-nums"
      >
        {formatDb(db)}
      </span>
      {main ? <PeakReadout analysers={analysers ?? NO_ANALYSERS} /> : null}
      {main ? null : (
        <div className="row-start-6 flex w-full gap-1">
          <Toggle
            aria-label={`${track.name} on`}
            className="flex-1"
            onPressedChange={setOn}
            pressed={!mix.muted}
            size="sm"
            variant="outline"
          >
            On
          </Toggle>
          <Toggle
            aria-label={`Solo ${track.name}`}
            className="flex-1"
            onPressedChange={setSolo}
            pressed={mix.soloed}
            size="sm"
            variant="outline"
          >
            S
          </Toggle>
        </div>
      )}
    </section>
  );
}

/**
 * The mixer: a channel for each track and return, then the main track. Each
 * change is a command of the arrangement (a drag a burst closed when it ends),
 * and the engine follows it; the meters read the engine's channels.
 */
export function MixerView({
  arrangement,
  engine,
  onMix,
  onSelectTrack,
  overridden,
  selectedTrack,
}: {
  arrangement: Arrangement;
  engine: Engine;
  /** A channel's mix changed: a fader's drag is a burst, a switch a step of its own, and an automated gain or pan is overridden. */
  onMix: (id: string, patch: Partial<Mix>) => void;
  onSelectTrack: (id: string) => void;
  /** What was moved by hand, by track: it stays as set. */
  overridden: Readonly<Record<string, readonly AutomatedParameter[]>>;
  selectedTrack: string | null;
}) {
  const { dispatch, doc } = arrangement;
  const onSend = useCallback(
    (track: string, to: string, level: number) =>
      dispatch({ level, to, track, type: "change-send" }),
    [dispatch]
  );
  const onSettle = useCallback(
    () => dispatch({ type: "settle-clip-edit" }),
    [dispatch]
  );
  const strip = (track: ArrangementTrack, main = false, sends = false) => (
    <Strip
      analysers={engine.meter(track.id)}
      following={{
        duration: doc.duration,
        overridden: overridden[track.id],
        position: engine.position,
      }}
      into={track.group ? trackOf(doc, track.group)?.name : undefined}
      key={track.id}
      main={main}
      onMix={onMix}
      onSelect={onSelectTrack}
      onSend={onSend}
      onSettle={onSettle}
      returns={doc.returns}
      selected={selectedTrack === track.id}
      sends={sends}
      track={track}
    />
  );
  return (
    // One grid for every channel, each a subgrid of its six rows (name, sends, pan, fader, level, switches): what one
    // channel lacks leaves its row empty, so every fader starts and ends level; the faders take the height there is,
    // and never less than 5rem, so the panel fits a short screen.
    <div
      aria-label="Mixer"
      className="grid h-full min-h-0 auto-cols-max grid-flow-col grid-rows-[auto_auto_auto_minmax(5rem,1fr)_auto_auto] [--fader-min-height:5rem] gap-y-2 no-scrollbar scroll-fade-s overflow-x-auto overflow-y-hidden pe-2"
      role="group"
    >
      {/* A folded group hides its tracks here too. */}
      {arrangement.unfoldedTracks.map((track) => strip(track, false, true))}
      {/* The returns and the main track stand apart from the tracks. */}
      <div
        aria-hidden="true"
        className="row-span-6 w-2 border-border border-e"
      />
      {doc.returns.map((track) => strip(track))}
      {strip(doc.main, true)}
    </div>
  );
}
