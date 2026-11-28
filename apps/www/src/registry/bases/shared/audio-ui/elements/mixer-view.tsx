import { createReorder, type ReorderDraft } from "@ui-sdk/core";
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { dbToGain, gainToDb, peakDb } from "@/engine/analysis";
import { formatLevel, formatPan as formatPanOf } from "@/engine/format";
import { BareButton } from "@/registry/bases/shared/audio-ui/elements/bare-button";
import { Fader } from "@/registry/bases/shared/audio-ui/elements/fader";
import { Knob } from "@/registry/bases/shared/audio-ui/elements/knob";
import { Led } from "@/registry/bases/shared/audio-ui/elements/led";
import { Meter } from "@/registry/bases/shared/audio-ui/elements/meter";
import {
  SWITCH_TONES,
  trackSwatch,
} from "@/registry/bases/shared/audio-ui/elements/timeline";
import { useAudioLevels } from "@/registry/bases/shared/hooks/analysis/use-audio-levels";
import { useLoudness } from "@/registry/bases/shared/hooks/analysis/use-loudness";
import type { useArrangement } from "@/registry/bases/shared/hooks/arrangement/use-arrangement";
import type { useArrangementEngine } from "@/registry/bases/shared/hooks/arrangement/use-arrangement-engine";
import {
  type AutomationFollowing,
  useAutomatedMix,
} from "@/registry/bases/shared/hooks/arrangement/use-track-automation";
import {
  type ArrangementTrack,
  type AutomatedParameter,
  hasOutput,
  type Mix,
} from "@/registry/lib/arrangement/arrangement";
import {
  trackBlock,
  trackOf,
} from "@/registry/lib/arrangement/arrangement-state";
import { cn } from "@/registry/lib/utils";
import type { MeterFrame } from "@/registry/primitives/meter/levels";
import type { Source } from "@/registry/primitives/primitive";

type Arrangement = ReturnType<typeof useArrangement>;
type Engine = ReturnType<typeof useArrangementEngine>;

/** The fader's floor: at it, the channel is silent (MIX-002). */
const MIN_DB = -60;
const MAX_DB = 6;
const NO_ANALYSERS: readonly AnalyserNode[] = [];
const SILENT: MeterFrame = {
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
  formatLevel(db <= MIN_DB ? Number.NEGATIVE_INFINITY : db, "dB", {
    unit: false,
  });
const formatPan = (pan: number) => formatPanOf(pan);
const formatSend = (level: number) =>
  formatLevel(level <= 0 ? Number.NEGATIVE_INFINITY : gainToDb(level), "dB", {
    sign: false,
  });

const formatLufs = (lufs: number, digits: number) =>
  formatLevel(lufs, "LUFS", { decimals: digits, unit: false });

/** The main track's meter is read to the dB: a scale beside it. */
const MAIN_MARKS = [0, -6, -12, -24, -48];

function StripMeter({
  label,
  levels,
  marks,
}: {
  label: string;
  levels: Source<MeterFrame>;
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
    <BareButton
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
    </BareButton>
  );
}

/**
 * How loud the mix is (MIX-025), in LUFS, integrated since it was last
 * cleared: what streaming services and broadcasters hold a file to, and what
 * an export normalizes to. A click clears it. Its text is written straight
 * into the page as the reading moves, so it costs no render.
 */
function LoudnessReadout({
  className,
  tap,
}: {
  className: string;
  tap: AudioNode | null;
}) {
  const { clear, source } = useLoudness(tap);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const paint = () => {
      const button = buttonRef.current;
      const label = button?.firstChild;
      if (!(button && label instanceof Text)) {
        return;
      }
      const { integrated } = source.getSnapshot();
      const text = `${formatLufs(integrated, 1)} LUFS`;
      // Its name moves by whole LU, so a screen reader is not read each tenth.
      const name = `Main loudness ${formatLufs(integrated, 0)} LUFS, click to clear`;
      // One text node's data, not its children: a change of children restyles the whole page.
      if (label.data !== text) {
        label.data = text;
      }
      if (button.ariaLabel !== name) {
        button.ariaLabel = name;
      }
    };
    paint();
    return source.subscribe(paint);
  }, [source]);
  return (
    <BareButton
      aria-label="Main loudness -∞ LUFS, click to clear"
      className={cn(
        "rounded-full border bg-muted/60 text-foreground text-xs tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={clear}
      ref={buttonRef}
      type="button"
    >
      -∞ LUFS
    </BareButton>
  );
}

/** A send of a channel to a return, from silence to 0 dB (MIX-007), named by the return's letter under it. */
function SendKnob({
  back,
  letter,
  onSend,
  onSettle,
  track,
}: {
  back: ArrangementTrack;
  /** The return's letter, A for the first: what the knob is labeled with. */
  letter: string;
  onSend: (id: string, to: string, level: number) => void;
  onSettle: () => void;
  track: ArrangementTrack;
}) {
  const change = useCallback(
    (level: number) => onSend(track.id, back.id, level),
    [back.id, onSend, track.id]
  );
  return (
    <span className="flex flex-col items-center">
      <Knob
        aria-label={`${track.name} send to ${back.name}`}
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
      <span
        aria-hidden="true"
        className="text-[10px] text-muted-foreground leading-3"
      >
        {letter}
      </span>
    </span>
  );
}

/** How a track's channel is moved: by its name, dragged or picked up with the keyboard. The same object for a channel from one render to the next. */
interface StripGrip {
  /** Joins the channel to the row, and returns what takes it out. */
  item: (element: HTMLElement | null) => (() => void) | undefined;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
}

interface ReorderState {
  moving: ReorderDraft | null;
  order: string[];
}

/** A store of one object, the two things `createReorder` asks of its owner. */
function reorderStore() {
  let state: ReorderState = { moving: null, order: [] };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch: Partial<ReorderState>) => {
      state = { ...state, ...patch };
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * The tracks' channels reordered by their names, with a pointer or the
 * keyboard, a group with its tracks: the order shown while one moves, and what
 * each channel's grip takes. Dropping sends the same command as a track moved
 * in the arrangement.
 */
function useChannelReorder(
  tracks: readonly ArrangementTrack[],
  dispatch: Arrangement["dispatch"]
) {
  const live = useRef({ dispatch, picked: "", tracks });
  live.current.dispatch = dispatch;
  live.current.tracks = tracks;
  const [{ cleanups, reorder, store }] = useState(() => {
    const held = reorderStore();
    const ends: (() => void)[] = [];
    const created = createReorder<ReorderState>(
      {
        onDestroy: (end: () => void) => ends.push(end),
        store: held,
      } as never,
      {
        draft: "moving",
        group: (id) => trackBlock(live.current.tracks, id),
        key: "order",
        label: (id) =>
          live.current.tracks.find((track) => track.id === id)?.name,
        orientation: () => "horizontal",
        preview: true,
        set: (order) => {
          const { picked } = live.current;
          // The command counts the index once the tracks moved have left their place: where the first of them is.
          flushSync(() =>
            live.current.dispatch({
              id: picked,
              index: order.indexOf(picked),
              type: "move-track",
            })
          );
          return true;
        },
        slot: "channel",
      }
    );
    return { cleanups: ends, reorder: created, store: held };
  });
  const ids = tracks.map((track) => track.id);
  const joined = ids.join(" ");
  useLayoutEffect(() => {
    store.set({ order: joined ? joined.split(" ") : [] });
  }, [joined, store]);
  useEffect(
    () => () => {
      for (const end of cleanups) {
        end();
      }
    },
    [cleanups]
  );
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const grips = useRef(new Map<string, StripGrip>());
  const grip = (id: string) => {
    const held = grips.current.get(id);
    if (held) {
      return held;
    }
    const made: StripGrip = {
      item: (element) =>
        element ? reorder.bind(element, { key: id, props: {} }) : undefined,
      onKeyDown: (event) => {
        if (!store.get().moving) {
          live.current.picked = id;
        }
        reorder.keydown(event.nativeEvent, id);
      },
      onPointerDown: (event) => {
        live.current.picked = id;
        reorder.pointerdown(event.nativeEvent, id);
      },
    };
    grips.current.set(id, made);
    return made;
  };
  return {
    /** Whether a pointer is dragging a channel, by itself or with its group. */
    dragging: (id: string) => reorder.dragging(state, id),
    grip,
    /** Whether a channel is picked up. */
    moving: (id: string) => reorder.moving(state, id),
    order: state.moving?.order ?? ids,
  };
}

interface StripProps {
  analysers: readonly AnalyserNode[] | null;
  /** Whether the track is armed to record (REC-001). */
  armed?: boolean;
  /** Whether a pointer is dragging the channel. */
  dragging?: boolean;
  /** With `overridden` and `position`, what the fader and the pan follow their envelopes by (AUT-006). */
  duration: AutomationFollowing["duration"];
  /** A track's channel moves by its name; a return and the main track stay where they are. */
  grip?: StripGrip;
  /** The group the track plays into, when it is in one (MIX-020). */
  into?: string;
  /** Main has no switch, no solo and no sends. */
  main?: boolean;
  /** Whether the channel is picked up to be moved. */
  moving?: boolean;
  /** Gives the channel an Arm switch, as its track's header has: `exclusive` is false when Cmd or Ctrl adds it to the armed ones. */
  onArm?: (id: string, exclusive: boolean) => void;
  onMix: (id: string, patch: Partial<Omit<Mix, "color">>) => void;
  onSelect: (id: string) => void;
  onSend: (id: string, to: string, level: number) => void;
  onSettle: () => void;
  overridden: AutomationFollowing["overridden"];
  position: AutomationFollowing["position"];
  returns: readonly ArrangementTrack[];
  selected: boolean;
  /** A return's own sends are off (MIX-008): it shows none. */
  sends?: boolean;
  /** What the main track sends on, which its loudness is read from; `null` until an engine runs. */
  tap?: AudioNode | null;
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

/** How a channel looks while it moves: dimmed under a pointer, ringed under the keyboard, and the copy that follows the pointer, cut down to its name. */
function reorderStyle(dragging: boolean, moving: boolean) {
  return cn(
    dragging && "opacity-30",
    moving && !dragging && "ring-2 ring-ring ring-inset",
    "data-drag-preview:h-8! data-drag-preview:grid-rows-1 data-drag-preview:overflow-hidden! data-drag-preview:rounded-md data-drag-preview:border data-drag-preview:bg-card data-drag-preview:shadow-md data-drag-preview:[&>:not(:first-child)]:hidden"
  );
}

/** A channel's name: the grip that moves it, for a channel that moves. */
function StripName({
  grip,
  track,
}: {
  grip: StripGrip | undefined;
  track: ArrangementTrack;
}) {
  if (!grip) {
    return (
      <span className="min-h-4 w-full truncate text-center font-medium text-xs">
        {track.name}
      </span>
    );
  }
  return (
    <BareButton
      aria-label={`Move ${track.name}`}
      className="min-h-4 w-full cursor-grab touch-none truncate rounded-sm text-center font-medium text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      data-mixer-grip={track.id}
      onKeyDown={grip.onKeyDown}
      onPointerDown={grip.onPointerDown}
      type="button"
    >
      {track.name}
    </BareButton>
  );
}

/**
 * A channel of the mixer: its sends, its pan, its fader and meter, its
 * switches; the main track's loudness in their place. Drawn again only when
 * what it shows changes: a channel moved past it leaves it as it is.
 */
const Strip = memo(function Channel({
  analysers,
  armed = false,
  dragging = false,
  duration,
  grip,
  into,
  main,
  moving = false,
  onArm,
  onMix,
  onSelect,
  onSend,
  onSettle,
  overridden,
  position,
  returns,
  selected,
  sends,
  tap = null,
  track,
}: StripProps) {
  const mix = useAutomatedMix(track, { duration, overridden, position });
  const swatch = trackSwatch(mix.color);
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
  // A MIDI track with no instrument has no output: no sends, pan or fader (MIX-024).
  const output = hasOutput(track);
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
        selected && "bg-muted",
        reorderStyle(dragging, moving)
      )}
      data-mixer-track={grip ? track.id : undefined}
      onPointerDown={select}
      ref={grip?.item}
    >
      <div className="row-start-1 flex w-full min-w-0 flex-col items-center gap-1.5">
        {/* The track's color, as its clips have it. */}
        <span
          aria-hidden="true"
          className={cn(
            "h-1 w-full rounded-b-sm",
            main ? "bg-foreground/25" : swatch.dot
          )}
          style={swatch.style}
        />
        <StripName grip={grip} track={track} />
        {into ? (
          <span className="w-full truncate text-center text-muted-foreground text-xs">
            To {into}
          </span>
        ) : null}
      </div>
      {sends && output ? (
        <div
          aria-label={`${track.name} sends`}
          className="row-start-2 flex flex-wrap justify-center gap-1"
          role="group"
        >
          {returns.map((back, index) => (
            <SendKnob
              back={back}
              key={back.id}
              letter={String.fromCharCode(65 + index)}
              onSend={onSend}
              onSettle={onSettle}
              track={track}
            />
          ))}
        </div>
      ) : null}
      {output ? (
        <>
          <span className="row-start-4 flex flex-col items-center">
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
            <span
              aria-hidden="true"
              className="text-[10px] text-muted-foreground leading-3"
            >
              Pan
            </span>
          </span>
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
        </>
      ) : null}
      {main ? (
        <LoudnessReadout
          className="row-start-7 h-5 w-24 self-center"
          tap={tap}
        />
      ) : (
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
});

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
  /** The tracks armed to record (REC-001). With `onArm`, their channels show an Arm light. */
  armed?: ReadonlySet<string>;
  arrangement: Arrangement;
  engine: Engine;
  /** Arms a track, or another one too with Cmd or Ctrl. Leave it out and no channel has an Arm switch. */
  onArm?: (track: string, exclusive: boolean) => void;
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
  const channels = useChannelReorder(arrangement.unfoldedTracks, dispatch);
  const strip = (
    track: ArrangementTrack,
    main = false,
    sends = false,
    moves?: StripGrip
  ) => (
    <Strip
      analysers={engine.meter(track.id)}
      armed={armed?.has(track.id)}
      dragging={channels.dragging(track.id)}
      duration={doc.duration}
      grip={moves}
      into={track.group ? trackOf(doc, track.group)?.name : undefined}
      key={track.id}
      main={main}
      moving={channels.moving(track.id)}
      onArm={moves && track.kind !== "group" ? onArm : undefined}
      onMix={onMix}
      onSelect={onSelectTrack}
      onSend={onSend}
      onSettle={onSettle}
      overridden={overridden[track.id]}
      position={engine.position}
      returns={doc.returns}
      selected={selectedTrack === track.id}
      sends={sends}
      tap={main ? engine.tap(track.id) : null}
      track={track}
    />
  );
  return (
    // One grid for every channel, each a subgrid of its six rows (name, sends, pan, fader, level, switches): what one
    // channel lacks leaves its row empty, so every fader starts and ends level; the faders take the height there is,
    // and never less than 5rem, so the panel fits a short screen. The channels scroll in a subgrid of their own, the
    // returns after the tracks', and the main track stays beside them at the right, whole: nothing passes under it.
    // One hairline between two channels, the main track's own before it.
    <div
      aria-label="Mixer"
      className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_auto_auto_minmax(5rem,1fr)_auto_auto] [--fader-min-height:5rem] gap-y-2 pe-2"
      role="group"
    >
      <div
        className="row-span-7 grid min-w-0 auto-cols-max grid-flow-col grid-rows-subgrid no-scrollbar scroll-fade-x overflow-x-auto overflow-y-hidden *:last:border-e-0"
        data-slot="mixer-channels"
      >
        {/* A folded group hides its tracks here too. While one moves, they stand in the order it would leave. */}
        {channels.order.map((id) => {
          const track = arrangement.unfoldedTracks.find(
            (candidate) => candidate.id === id
          );
          return track ? strip(track, false, true, channels.grip(id)) : null;
        })}
        {doc.returns.map((track) => strip(track))}
      </div>
      {strip(doc.main, true)}
    </div>
  );
}
