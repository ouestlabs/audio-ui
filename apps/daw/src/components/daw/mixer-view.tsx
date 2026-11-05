import { dbToGain, gainToDb, peakDb } from "@audio-ui/core/analysis";
import type { Meter as MeterPrimitive, Source } from "@audio-ui/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { Fader } from "@/components/audio-ui/fader";
import { Knob } from "@/components/audio-ui/knob";
import { Led } from "@/components/audio-ui/led";
import { Meter } from "@/components/audio-ui/meter";
import { SWITCH_TONES, TRACK_COLORS } from "@/components/audio-ui/timeline";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { trackBlock, trackOf } from "@/lib/arrangement-state";
import { startSortableDrag } from "@/lib/sortable-drag";
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
 * The loudest sample a channel has played since it was last cleared, in dB
 * (MIX-011), red once one went over 0 dBFS; a click clears it. Read from the
 * channel's analysers each frame, and written straight into the page when it
 * rises, so it costs no render. Every channel's, the main track's too, is a
 * pill over its pan.
 */
function PeakReadout({
  analysers,
  className,
  name,
}: {
  analysers: readonly AnalyserNode[];
  className: string;
  name: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const held = useRef(Number.NEGATIVE_INFINITY);
  const paint = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const text = formatDb(held.current);
    button.textContent = text;
    button.ariaLabel = `${name} peak ${text} dB, click to clear`;
    button.toggleAttribute("data-over", held.current >= 0);
  }, [name]);
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
      aria-label={`${name} peak -∞ dB, click to clear`}
      className={cn(
        "rounded-full border bg-muted/60 text-foreground text-xs tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-over:border-destructive data-over:bg-destructive/10 data-over:text-destructive",
        className
      )}
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
      dragMode="vertical"
      formatValue={formatSend}
      max={1}
      min={0}
      onValueChange={change}
      onValueCommitted={onSettle}
      size="xs"
      step={0.01}
      value={track.sends?.[back.id] ?? 0}
      valueLabel="hidden"
    />
  );
}

/** How a track's channel is moved: its name, dragged, or with Left and Right on it. */
interface StripGrip {
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
}

interface StripProps {
  analysers: readonly AnalyserNode[] | null;
  /** Whether the track is armed to record (REC-001). */
  armed?: boolean;
  /** What the fader and the pan follow their envelopes by (AUT-006). */
  following: AutomationFollowing;
  /** A track's channel moves by its name; a return and the main track stay where they are. */
  grip?: StripGrip;
  /** The group the track plays into, when it is in one (MIX-020). */
  into?: string;
  /** Main has no switch, no solo and no sends. */
  main?: boolean;
  /** Gives the channel an Arm switch, as its track's header has: `exclusive` is false when Cmd or Ctrl adds it to the armed ones. */
  onArm?: (id: string, exclusive: boolean) => void;
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

/** A channel's switch: an equal share of its width, inside its edges. */
const SWITCH = "min-w-0 flex-1 shrink basis-0 px-0";

/** A channel's switches, the same as its track's header: one group, one stop of Tab, the arrows between them. */
function StripSwitches({
  armed,
  muted,
  name,
  onArm,
  onMute,
  onSolo,
  soloed,
}: {
  armed: boolean;
  muted: boolean;
  name: string;
  onArm?: (event: MouseEvent<HTMLButtonElement>) => void;
  onMute: () => void;
  onSolo: () => void;
  soloed: boolean;
}) {
  return (
    <ToggleGroup
      aria-label={`${name} switches`}
      className="row-start-7 w-full min-w-0"
      multiple
      size="sm"
      spacing={1}
      value={[
        ...(soloed ? ["solo"] : []),
        ...(muted ? ["mute"] : []),
        ...(armed ? ["arm"] : []),
      ]}
      variant="outline"
    >
      <ToggleGroupItem
        aria-label={`Solo ${name}`}
        className={cn(SWITCH, SWITCH_TONES.solo)}
        onClick={onSolo}
        value="solo"
      >
        S
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label={`Mute ${name}`}
        className={cn(SWITCH, SWITCH_TONES.mute)}
        onClick={onMute}
        value="mute"
      >
        M
      </ToggleGroupItem>
      {onArm ? (
        <ToggleGroupItem
          aria-label={`Arm ${name}`}
          className={SWITCH}
          onClick={onArm}
          value="arm"
        >
          <span aria-hidden="true" className="contents">
            <Led label="Armed" on={armed} tone="destructive" />
          </span>
        </ToggleGroupItem>
      ) : null}
    </ToggleGroup>
  );
}

/** A channel of the mixer: its sends, its pan, its fader and meter, its switches. */
function Strip({
  analysers,
  armed = false,
  following,
  grip,
  into,
  main,
  onArm,
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
  const toggleMute = useCallback(
    () => onMix(track.id, { muted: !mix.muted }),
    [mix.muted, onMix, track.id]
  );
  const toggleSolo = useCallback(
    () => onMix(track.id, { soloed: !mix.soloed }),
    [mix.soloed, onMix, track.id]
  );
  const toggleArm = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      onArm?.(track.id, !(event.metaKey || event.ctrlKey)),
    [onArm, track.id]
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
        "row-span-7 grid w-28 grid-rows-subgrid justify-items-center border-border/60 border-e px-2 pb-2 transition-colors",
        // The main track is wider: its meter has a scale.
        main && "w-36 border-s border-e-0",
        track.kind === "group" && "bg-muted/40",
        selected && "bg-muted"
      )}
      data-mixer-track={grip ? track.id : undefined}
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
        {grip ? (
          <button
            aria-label={`Move ${track.name}`}
            className="min-h-4 w-full cursor-grab touch-none truncate rounded-sm text-center font-medium text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            data-mixer-grip={track.id}
            type="button"
            {...grip}
          >
            {track.name}
          </button>
        ) : (
          <span className="min-h-4 w-full truncate text-center font-medium text-xs">
            {track.name}
          </span>
        )}
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
        className="row-start-4"
        dragMode="vertical"
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
      <div className="row-start-5 flex min-h-0 justify-center gap-1.5">
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
      {/* A pill over the pan, as the reference draws it: the loudest peak since it was cleared. */}
      <PeakReadout
        analysers={analysers ?? NO_ANALYSERS}
        className="row-start-3 h-5 w-14"
        name={main ? "Main" : track.name}
      />
      <span
        aria-hidden="true"
        className="row-start-6 text-muted-foreground text-xs tabular-nums"
      >
        {formatDb(db)}
      </span>
      {main ? null : (
        <StripSwitches
          armed={armed}
          muted={mix.muted}
          name={track.name}
          onArm={onArm ? toggleArm : undefined}
          onMute={toggleMute}
          onSolo={toggleSolo}
          soloed={mix.soloed}
        />
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
  armed,
  arrangement,
  engine,
  onArm,
  onMix,
  onSelectTrack,
  overridden,
  selectedTrack,
}: {
  /** The tracks armed to record (REC-001). */
  armed: ReadonlySet<string>;
  arrangement: Arrangement;
  engine: Engine;
  /** Arms a track, or another one too with Cmd or Ctrl. */
  onArm: (track: string, exclusive: boolean) => void;
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
  const channelsRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [lifted, setLifted] = useState<{
    left: number;
    name: string;
    top: number;
  } | null>(null);
  const live = useRef({ dispatch, tracks: arrangement.unfoldedTracks });
  live.current = { dispatch, tracks: arrangement.unfoldedTracks };
  // The tracks' channels reorder as their rows do in the arrangement: the same gesture, the same command.
  const grip = useCallback(
    (id: string, name: string): StripGrip => ({
      onKeyDown: (event) => {
        const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        const from = live.current.tracks.findIndex((track) => track.id === id);
        if (direction && from !== -1) {
          event.preventDefault();
          live.current.dispatch({
            id,
            index: from + direction,
            type: "move-track",
          });
        }
      },
      onPointerDown: (event) => {
        const channels = channelsRef.current;
        if (event.button !== 0 || !channels) {
          return;
        }
        const items = Array.from(
          channels.querySelectorAll<HTMLElement>("[data-mixer-track]")
        );
        const from = items.findIndex((item) => item.dataset.mixerTrack === id);
        if (from === -1) {
          return;
        }
        event.preventDefault();
        const block = new Set(trackBlock(live.current.tracks, id));
        const box = event.currentTarget.getBoundingClientRect();
        startSortableDrag({
          axis: "x",
          count: Math.max(
            1,
            items.filter((item) => block.has(item.dataset.mixerTrack ?? ""))
              .length
          ),
          free: true,
          from,
          ghost: () => ghostRef.current,
          items,
          onEnd: (landed) =>
            flushSync(() => {
              setLifted(null);
              if (landed !== null) {
                live.current.dispatch({
                  id,
                  index: landed,
                  type: "move-track",
                });
              }
            }),
          onLift: () => setLifted({ left: box.left, name, top: box.top }),
          scroller: channels,
          x: event.clientX,
          y: event.clientY,
        });
      },
    }),
    []
  );
  const strip = (
    track: ArrangementTrack,
    main = false,
    sends = false,
    moves?: StripGrip
  ) => (
    <Strip
      analysers={engine.meter(track.id)}
      armed={armed.has(track.id)}
      following={{
        duration: doc.duration,
        overridden: overridden[track.id],
        position: engine.position,
      }}
      grip={moves}
      into={track.group ? trackOf(doc, track.group)?.name : undefined}
      key={track.id}
      main={main}
      onArm={moves && track.kind !== "group" ? onArm : undefined}
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
    // and never less than 5rem, so the panel fits a short screen. The channels scroll in a subgrid of their own, and
    // the main track stays beside them at the right, whole: nothing passes under it. One hairline between two
    // channels, the main track's own before it.
    <div
      aria-label="Mixer"
      className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_auto_auto_minmax(5rem,1fr)_auto_auto] [--fader-min-height:5rem] gap-y-2 pe-2"
      role="group"
    >
      <div
        className="row-span-7 grid min-w-0 auto-cols-max grid-flow-col grid-rows-subgrid no-scrollbar scroll-fade-x overflow-x-auto overflow-y-hidden *:last:border-e-0"
        data-slot="mixer-channels"
        ref={channelsRef}
      >
        {/* A folded group hides its tracks here too. */}
        {arrangement.unfoldedTracks.map((track) =>
          strip(track, false, true, grip(track.id, track.name))
        )}
        {doc.returns.map((track) => strip(track))}
      </div>
      {strip(doc.main, true)}
      {lifted
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-50 flex h-7 max-w-40 items-center rounded-md border bg-card px-2.5 font-medium text-xs shadow-md"
              data-slot="mixer-ghost"
              ref={ghostRef}
              style={{ left: lifted.left, top: lifted.top }}
            >
              <span className="truncate">{lifted.name}</span>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
