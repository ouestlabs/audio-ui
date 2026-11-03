import { dbToGain, gainToDb } from "@audio-ui/core/analysis";
import type { Meter as MeterPrimitive } from "@audio-ui/react";
import { useCallback } from "react";
import { Fader } from "@/components/audio-ui/fader";
import { Knob } from "@/components/audio-ui/knob";
import { Meter } from "@/components/audio-ui/meter";
import { Toggle } from "@/components/ui/toggle";
import type { useArrangement } from "@/hooks/use-arrangement";
import type { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import { useAudioLevels } from "@/hooks/use-audio-levels";
import { type ArrangementTrack, type Mix, mixOf } from "@/lib/arrangement";
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

function StripMeter({
  analysers,
  label,
}: {
  analysers: readonly AnalyserNode[] | null;
  label: string;
}) {
  const levels = useAudioLevels(analysers ?? NO_ANALYSERS);
  return (
    <Meter
      aria-label={`${label} level`}
      className="data-[orientation=vertical]:h-full"
      size="sm"
      source={analysers ? levels : SILENT_SOURCE}
      warnThreshold={-12}
    />
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
  /** Main has no switch, no solo and no sends. */
  main?: boolean;
  onMix: (
    id: string,
    patch: Partial<Omit<Mix, "color">>,
    burst: boolean
  ) => void;
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
  const mix = mixOf(track);
  const setGain = useCallback(
    (volume: number) => onMix(track.id, { gain: gainOf(volume) }, true),
    [onMix, track.id]
  );
  const setPan = useCallback(
    (pan: number) => onMix(track.id, { pan }, true),
    [onMix, track.id]
  );
  const setOn = useCallback(
    (on: boolean) => onMix(track.id, { muted: !on }, false),
    [onMix, track.id]
  );
  const setSolo = useCallback(
    (soloed: boolean) => onMix(track.id, { soloed }, false),
    [onMix, track.id]
  );
  const select = useCallback(() => onSelect(track.id), [onSelect, track.id]);
  const db = decibels(mix.gain);
  return (
    <section
      aria-label={track.name}
      className={cn(
        "flex w-28 shrink-0 flex-col items-center gap-2 rounded-lg border bg-background p-2 *:shrink-0",
        selected && "border-primary"
      )}
      onPointerDown={select}
    >
      <span className="w-full truncate text-center font-medium text-xs">
        {track.name}
      </span>
      {sends ? (
        <div
          aria-label={`${track.name} sends`}
          className="flex flex-wrap justify-center gap-1"
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
      <div className="flex h-40 justify-center gap-1.5">
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
        <StripMeter analysers={analysers} label={track.name} />
      </div>
      <span
        aria-hidden="true"
        className="text-muted-foreground text-xs tabular-nums"
      >
        {formatDb(db)}
      </span>
      {main ? null : (
        <div className="flex w-full gap-1">
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
  onSelectTrack,
  selectedTrack,
}: {
  arrangement: Arrangement;
  engine: Engine;
  onSelectTrack: (id: string) => void;
  selectedTrack: string | null;
}) {
  const { dispatch, doc } = arrangement;
  const onMix = useCallback(
    (id: string, patch: Partial<Omit<Mix, "color">>, burst: boolean) =>
      dispatch({ id, patch, type: burst ? "change-mix" : "set-mix" }),
    [dispatch]
  );
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
    <div
      aria-label="Mixer"
      className="flex h-full min-h-0 items-start gap-2 overflow-auto p-2"
      role="group"
    >
      {doc.tracks.map((track) => strip(track, false, true))}
      <div aria-hidden="true" className="w-px shrink-0 bg-border" />
      {doc.returns.map((track) => strip(track))}
      <div aria-hidden="true" className="w-px shrink-0 bg-border" />
      {strip(doc.main, true)}
    </div>
  );
}
