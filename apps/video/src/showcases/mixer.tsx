import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { clamp, MOTION, ramp, tw } from "../motion.ts";

const FLOOR = -60;
const MAX_DB = 6;
const BPM = 100;
const BEAT = 60 / BPM;
/** How fast a level falls back once the signal drops, as the meters' own hook lets it: 30 dB a second. */
const RELEASE_DB_PER_SECOND = 30;
const RELEASE_STEPS = 24;
const RELEASE_STEP = 1 / 60;
/** How long a mute or a solo takes to reach the sound, in seconds. */
const SWITCH_SECONDS = 0.08;

const SOLO_ON = 3.8;
const SOLO_OFF = 5.6;
const MUTE_ON = 6;
const SWITCH =
  "min-w-0 flex-1 px-0 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

const CHANNELS = [
  { fader: 0, id: "drums", label: "Drums", pan: 0, scale: 1 },
  { fader: -4, id: "bass", label: "Bass", pan: 0, scale: 0.45 },
  { fader: -6, id: "keys", label: "Keys", pan: -0.3, scale: 0.3 },
  { fader: -9, id: "pad", label: "Pad", pan: 0.3, scale: 0.15 },
] as const;

const DRUMS = 0;
const BASS = 1;
const KEYS = 2;

/** The amplitude of a note struck at each time of `hits`, at `t`: it rises at once and dies over `decay` seconds. */
function struck(t: number, hits: readonly number[], decay: number) {
  let amplitude = 0;
  for (const hit of hits) {
    if (t >= hit) {
      amplitude = Math.max(amplitude, Math.exp(-(t - hit) / decay));
    }
  }
  return amplitude;
}

/** Each beat of a four-beat bar, the bar `bar` of the loop, as a start in seconds. */
function inBar(t: number, beats: readonly number[]) {
  const bar = Math.floor(t / (BEAT * 4));
  return [bar - 1, bar].flatMap((index) =>
    beats.map((beat) => (index * 4 + beat) * BEAT)
  );
}

/** The signal of channel `index` at `t`, before its fader, from 0 to 1. */
function signal(index: number, t: number) {
  if (t < 0) {
    return 0;
  }
  if (index === DRUMS) {
    const kick = struck(t, inBar(t, [0, 2, 2.5]), 0.16);
    const snare = struck(t, inBar(t, [1, 3]), 0.1);
    const hats = struck(t, inBar(t, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]), 0.04);
    return Math.max(0.95 * kick, 0.7 * snare, 0.3 * hats);
  }
  if (index === BASS) {
    return 0.8 * struck(t, inBar(t, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]), 0.22);
  }
  if (index === KEYS) {
    return 0.9 * struck(t, inBar(t, [0.5, 1.5, 2.5, 3.5]), 0.12);
  }
  // The pad swells in with each bar and holds.
  const inside = (t % (BEAT * 4)) / (BEAT * 4);
  return 0.7 * (0.55 + 0.45 * Math.sin(inside * Math.PI));
}

const step = (t: number, at: number) => ramp(t - at, SWITCH_SECONDS);

/** What the controls are at `t`: the faders, the pan, the mute and the solo, each moved by a hand. */
function controls(t: number) {
  const solo = step(t, SOLO_ON) - step(t, SOLO_OFF);
  const mute = step(t, MUTE_ON);
  return {
    bassFader: tw(t, 1.2, 2.2, -4, -12, MOTION.enter),
    keysPan: tw(t, 1, 3.6, -0.3, 0.6, MOTION.move),
    mute,
    muted: t >= MUTE_ON,
    solo,
    soloed: t >= SOLO_ON && t < SOLO_OFF,
  };
}

const toDb = (amplitude: number) =>
  amplitude > 0 ? 20 * Math.log10(amplitude) : Number.NEGATIVE_INFINITY;

/** A channel's gain at `t`: its fader, and whether a mute or a solo lets it through. */
function gainOf(index: number, t: number) {
  const state = controls(t);
  let fader: number = CHANNELS[index]?.fader ?? 0;
  if (index === BASS) {
    fader = state.bassFader;
  }
  // The soloed track is let through; the others go quiet while it is.
  let audible = index === KEYS ? 1 : 1 - state.solo;
  if (index === DRUMS) {
    audible *= 1 - state.mute;
  }
  return 10 ** (fader / 20) * audible;
}

/** A meter's reading: it rises at once and falls at 30 dB a second, from what the signal did just before. */
function ballistics(level: (at: number) => number, t: number) {
  let reading = FLOOR;
  for (let back = 0; back < RELEASE_STEPS; back += 1) {
    const seconds = back * RELEASE_STEP;
    reading = Math.max(
      reading,
      level(t - seconds) - RELEASE_DB_PER_SECOND * seconds
    );
  }
  return clamp(reading, FLOOR, MAX_DB);
}

const channelLevel = (index: number, at: number) =>
  toDb(
    signal(index, at) * (CHANNELS[index]?.scale ?? 1) * gainOf(index, at) * 1.4
  );

/** The master's left and right: every channel through an equal-power pan, summed in power. */
function masterLevel(side: 0 | 1, at: number) {
  const state = controls(at);
  let power = 0;
  CHANNELS.forEach((channel, index) => {
    const pan = index === KEYS ? state.keysPan : channel.pan;
    const angle = ((pan + 1) * Math.PI) / 4;
    const share = side === 0 ? Math.cos(angle) : Math.sin(angle);
    const amplitude =
      signal(index, at) * channel.scale * gainOf(index, at) * share * 1.4;
    power += amplitude * amplitude;
  });
  return toDb(Math.sqrt(power) * Math.SQRT2);
}

const formatDb = (db: number) =>
  db <= FLOOR ? "-∞" : `${db > 0 ? "+" : ""}${db.toFixed(1)}`;
const formatVolume = (db: number) => `${formatDb(db)} dB`;
const formatPan = (pan: number) => {
  const amount = Math.round(Math.abs(pan) * 100);
  if (amount === 0) {
    return "C";
  }
  return `${pan < 0 ? "L" : "R"}${amount}`;
};

function Strip({
  fader,
  label,
  level,
  muted,
  pan,
  soloed,
}: {
  fader: number;
  label: string;
  level: number;
  muted: boolean;
  pan: number;
  soloed: boolean;
}) {
  return (
    <div
      aria-label={label}
      className="row-span-5 grid min-w-0 grid-rows-subgrid justify-items-center"
      role="group"
    >
      <Knob
        anchor={0}
        aria-label={`${label} pan`}
        formatValue={formatPan}
        max={1}
        min={-1}
        size="sm"
        step={0.01}
        value={pan}
        valueLabel="always"
      />
      <div className="flex h-44 justify-center gap-1.5">
        <Fader
          aria-label={`${label} volume`}
          formatValue={formatVolume}
          max={MAX_DB}
          min={FLOOR}
          size="sm"
          step={0.5}
          thumbMarks={1}
          value={fader}
          valueLabel="hidden"
        />
        <Meter
          aria-label={`${label} level`}
          className="data-[orientation=vertical]:h-full"
          peakMarks="hidden"
          size="sm"
          value={[level]}
          warnThreshold={-12}
        />
      </div>
      <span
        aria-hidden="true"
        className="text-muted-foreground text-xs tabular-nums"
      >
        {formatDb(fader)}
      </span>
      <div className="flex w-full gap-1">
        <Toggle
          aria-label={`Mute ${label}`}
          className={SWITCH}
          pressed={muted}
          size="sm"
          variant="outline"
        >
          M
        </Toggle>
        <Toggle
          aria-label={`Solo ${label}`}
          className={SWITCH}
          pressed={soloed}
          size="sm"
          variant="outline"
        >
          S
        </Toggle>
      </div>
      <span className="max-w-full truncate text-xs">{label}</span>
    </div>
  );
}

/** Four tracks of a loop into a master: a bass pushed down, a pan swept, a solo, then a mute. */
export function MixerShowcase({ t }: { t: number }) {
  const on = MOTION.enter(ramp(t, 0.6));
  const state = controls(t);
  const shown = (level: (at: number) => number) =>
    FLOOR + (ballistics(level, t) - FLOOR) * on;
  return (
    <div className="mx-auto grid h-full w-full max-w-md grid-cols-[repeat(4,minmax(0,1fr))_minmax(min-content,1fr)] content-center gap-2">
      {CHANNELS.map((channel, index) => (
        <Strip
          fader={index === BASS ? state.bassFader : channel.fader}
          key={channel.id}
          label={channel.label}
          level={shown((at) => channelLevel(index, at))}
          muted={index === DRUMS && state.muted}
          pan={index === KEYS ? state.keysPan : channel.pan}
          soloed={index === KEYS && state.soloed}
        />
      ))}
      <div
        aria-label="Master"
        className="row-span-5 grid min-w-0 grid-rows-subgrid justify-items-center border-s ps-2"
        role="group"
      >
        <Button aria-label="Stop" size="icon">
          <IconPlaceholder
            hugeicons="StopIcon"
            lucide="SquareIcon"
            phosphor="StopIcon"
            remixicon="RiStopFill"
            tabler="IconPlayerStopFilled"
          />
        </Button>
        <div className="flex h-44 justify-center gap-1.5">
          <Fader
            aria-label="Master volume"
            formatValue={formatVolume}
            max={MAX_DB}
            min={FLOOR}
            size="sm"
            step={0.5}
            thumbMarks={1}
            value={0}
            valueLabel="hidden"
          />
          <Meter
            aria-label="Master level"
            className="data-[orientation=vertical]:h-full"
            peakMarks="hidden"
            size="sm"
            value={[
              shown((at) => masterLevel(0, at)),
              shown((at) => masterLevel(1, at)),
            ]}
            warnThreshold={-12}
          />
        </div>
        <span
          aria-hidden="true"
          className="text-muted-foreground text-xs tabular-nums"
        >
          {formatDb(0)}
        </span>
        <div />
        <span className="text-xs">Master</span>
      </div>
    </div>
  );
}
