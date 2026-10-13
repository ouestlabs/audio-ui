import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import {
  glyphEntrance,
  LOGO_PATH,
  Lockup,
  LockupUrl,
  Rise,
} from "../brand.tsx";
import { lerp, MOTION, ramp, tw, useSeconds } from "../motion.ts";
import { SHOWCASES } from "../showcases/index.ts";
import { knobRing, knobValue } from "../showcases/knob.tsx";

/** The sections, in seconds: the cue of each is the sum of the ones before. */
const SCENES = {
  Intro: 2.8,
  Controls: 7.2,
  Editors: 9.6,
  Assemble: 4.8,
  Outro: 3.8,
};
export const TEASER_SECONDS = Object.values(SCENES).reduce(
  (sum, length) => sum + length,
  0
);
const CUES = {
  Controls: SCENES.Intro,
  Editors: SCENES.Intro + SCENES.Controls,
  Assemble: SCENES.Intro + SCENES.Controls + SCENES.Editors,
  Outro: SCENES.Intro + SCENES.Controls + SCENES.Editors + SCENES.Assemble,
};

/**
 * The glyph opens the piece, in one piece: it comes into focus and settles
 * like a knob coming to rest, and the camera slides it aside for its name.
 * Then it lightens into the real Cutoff knob it stands for, at the same size
 * and angle, its panel appears round it, and the camera pulls back onto it.
 */
const INTRO = {
  /** The glyph comes into focus and settles. */
  appear: { end: 0.6, start: 0.05 },
  /** It lightens into the knob, then the knob's details show. */
  back: { end: 2.35, start: 2 },
  /** The camera pulls back onto the panel. */
  camera: { end: 3.3, start: 1.95 },
  /** The wordmark leaves. */
  leave: 1.9,
  /** The camera slides the glyph aside for its name. */
  room: { end: 1.25, start: 0.55 },
  word: 0.7,
};
const INTRO_SCALE = 2.4;
/** Progress through an intro span, from 0 to 1. */
const within = (T: number, span: { end: number; start: number }) =>
  ramp(T - span.start, span.end - span.start);
/** The `lg` knob's diameter, in px. */
const KNOB_SIZE = 64;
/** The glyph's disc is 20 of its 24 units: it is drawn as wide as the dial. */
const GLYPH_SIZE = (KNOB_SIZE * INTRO_SCALE * 24) / 20;
/** How much the glyph's disc still hides the knob's details. */
const coverAt = (T: number) =>
  1 - MOTION.enter(ramp(T - INTRO.back.start - 0.1, 0.25));
/** How dark the glyph still is. */
const darkAt = (T: number) => 1 - MOTION.move(ramp(T - INTRO.back.start, 0.3));

const CONTROLS = ["knob", "fader", "meter", "xypad"];
const EDITORS = [
  "waveform",
  "envelope",
  "plot",
  "sequencer",
  "piano",
  "timeline",
];

type Box = { h: number; w: number; x: number; y: number };

/** Where each panel sits on the instrument, in px of the world the camera films. Rows of 240, 280, 140 and 192, 16 apart. */
const LANDSCAPE = {
  frame: { H: 1080, W: 1920, worldH: 900, worldW: 1600 },
  intro: { glyph: { x: 680, y: 540 } },
  label: [88, 80],
  layout: {
    envelope: { h: 280, w: 604, x: 396, y: 256 },
    fader: { h: 140, w: 584, x: 1016, y: 552 },
    knob: { h: 240, w: 440, x: 1160, y: 0 },
    meter: { h: 240, w: 128, x: 1016, y: 0 },
    piano: { h: 192, w: 584, x: 1016, y: 708 },
    plot: { h: 280, w: 584, x: 1016, y: 256 },
    sequencer: { h: 192, w: 1000, x: 0, y: 708 },
    timeline: { h: 240, w: 1000, x: 0, y: 0 },
    waveform: { h: 140, w: 1000, x: 0, y: 552 },
    xypad: { h: 280, w: 380, x: 0, y: 256 },
  } as Record<string, Box>,
  outro: { centerY: 380, scale: 0.56, textY: 790 },
  overview: { s: 1, x: 800, y: 450 },
  wipeRadius: 1200,
  zoom: {
    envelope: 1.9,
    fader: 2,
    knob: 2.6,
    meter: 2.4,
    piano: 1.9,
    plot: 1.9,
    sequencer: 1.6,
    timeline: 1.7,
    waveform: 1.6,
    xypad: 2.2,
  } as Record<string, number>,
};

type Format = typeof LANDSCAPE;
type Shot = { length: number; name: string; start: number };
type Camera = { s: number; x: number; y: number };

/** Each panel gets one shot: the controls share their section evenly, the editors theirs. */
const SHOTS: Shot[] = [
  ...CONTROLS.map((name, index) => {
    const length = SCENES.Controls / CONTROLS.length;
    return { length, name, start: CUES.Controls + index * length };
  }),
  ...EDITORS.map((name, index) => {
    const length = SCENES.Editors / EDITORS.length;
    return { length, name, start: CUES.Editors + index * length };
  }),
];
/**
 * A panel rises in a little before its shot, before the camera reaches it. The first one fades in, in
 * place, around the knob the glyph has just become again.
 */
const revealAt = (index: number) =>
  index === 0 ? INTRO.back.start + 0.15 : (SHOTS[index]?.start ?? 0) - 0.35;
const revealLength = (index: number) => (index === 0 ? 0.5 : 0.6);
const rises = (index: number) => (index === 0 ? 0 : 1);
/**
 * A panel plays from the moment it starts to appear, so it never comes in
 * still; the first one as the glyph dissolves off its knob.
 */
const playAt = (index: number) =>
  index === 0 ? INTRO.back.start + 0.25 : revealAt(index);

const center = (box: Box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

/** The first knob's dial, in the world: the first of four columns, under its label (see showcases/knob.tsx). */
function firstKnob(format: Format) {
  const box = format.layout.knob as Box;
  // 1px border and 16px padding round a 4-column grid; a 16px label and 8px gap above the dial.
  return { x: box.x + 17 + (box.w - 34) / 8, y: box.y + 116 };
}

/** The camera that sets the knob, as the glyph, where the lockup puts it. */
function lockupCamera(format: Format): Camera {
  const knob = firstKnob(format);
  const { H, W } = format.frame;
  return {
    s: INTRO_SCALE,
    x: knob.x - (format.intro.glyph.x - W / 2) / INTRO_SCALE,
    y: knob.y - (format.intro.glyph.y - H / 2) / INTRO_SCALE,
  };
}
const mix = (from: Camera, to: Camera, progress: number): Camera => ({
  // The scale moves geometrically, so a zoom feels even all the way.
  s: from.s * (to.s / from.s) ** progress,
  x: lerp(from.x, to.x, progress),
  y: lerp(from.y, to.y, progress),
});

function camera(T: number, format: Format): Camera {
  const on = (name: string, hold = 1): Camera => ({
    ...center(format.layout[name] as Box),
    s: (format.zoom[name] ?? 1) * hold,
  });
  const first = SHOTS[0] as Shot;
  if (T < first.start + first.length) {
    // The glyph in the middle, gently pushed in; aside for the name; then
    // onto the panel as the knob, and the slow push of the shot.
    const knob = firstKnob(format);
    const alone = mix(
      { ...knob, s: INTRO_SCALE },
      lockupCamera(format),
      MOTION.move(within(T, INTRO.room))
    );
    const push = lerp(0.96, 1, MOTION.enter(ramp(T, INTRO.room.end)));
    const cam = mix(
      { ...alone, s: alone.s * push },
      on(first.name),
      MOTION.move(within(T, INTRO.camera))
    );
    const pushFor = first.start + first.length - INTRO.camera.end;
    return {
      ...cam,
      s: cam.s * (1 + 0.035 * ramp(T - INTRO.camera.end, pushFor)),
    };
  }
  if (T < CUES.Assemble) {
    const index = Math.max(
      0,
      SHOTS.findIndex((each) => T < each.start + each.length)
    );
    const shot = SHOTS[index] as Shot;
    const travel = Math.min(0.8, shot.length * 0.45);
    // It leaves each panel slightly pushed in. The push runs the whole shot,
    // under the travel, so the camera never comes to a stop on a panel.
    const from = on((SHOTS[index - 1] as Shot).name, 1.035);
    const cam = mix(
      from,
      on(shot.name),
      MOTION.move(ramp(T - shot.start, travel))
    );
    return {
      ...cam,
      s: cam.s * (1 + 0.035 * ramp(T - shot.start, shot.length)),
    };
  }
  if (T < CUES.Outro) {
    const cam = mix(
      on("timeline", 1.035),
      format.overview,
      MOTION.move(ramp(T - CUES.Assemble, 2.2))
    );
    return {
      ...cam,
      s:
        cam.s *
        (1 + 0.03 * ramp(T - CUES.Assemble - 2.2, SCENES.Assemble - 2.2)),
    };
  }
  const { H } = format.frame;
  const cam = mix(
    { ...format.overview, s: format.overview.s * 1.03 },
    {
      s: format.outro.scale,
      x: format.overview.x,
      y:
        format.overview.y + (H / 2 - format.outro.centerY) / format.outro.scale,
    },
    MOTION.move(ramp(T - CUES.Outro, 1.4))
  );
  return { ...cam, s: cam.s * (1 + 0.025 * ramp(T - CUES.Outro - 1.4, 2.5)) };
}

function Instrument({
  T,
  cam,
  format,
}: {
  T: number;
  cam: Camera;
  format: Format;
}) {
  const { H, W, worldH, worldW } = format.frame;
  const timeline = center(format.layout.timeline as Box);
  const tray = tw(
    T,
    CUES.Assemble + 1.3,
    CUES.Assemble + 2.3,
    0,
    1,
    MOTION.enter
  );
  return (
    <div
      className="absolute top-0 left-0 origin-top-left"
      style={{
        height: worldH,
        transform: `translate(${W / 2}px, ${H / 2}px) scale(${cam.s}) translate(${-cam.x}px, ${-cam.y}px)`,
        width: worldW,
      }}
    >
      <div
        className="-inset-3.5 absolute rounded-3xl border bg-muted/50"
        style={{
          boxShadow: `0 60px 120px -40px rgb(0 0 0 / ${0.08 * tray})`,
          opacity: tray,
        }}
      />
      {SHOTS.map((shot, index) => {
        const box = format.layout[shot.name] as Box;
        const showcase = SHOWCASES[shot.name];
        if (!showcase) {
          return null;
        }
        const { Demo } = showcase;
        const reveal = revealAt(index);
        const last = index === SHOTS.length - 1;
        const focus = Math.min(
          ramp(T - (index === 0 ? shot.start - 1 : shot.start - 0.5), 0.5),
          last ? 1 : 1 - ramp(T - (shot.start + shot.length - 0.1), 0.5)
        );
        // When the camera pulls back, the panels light up in a ripple from the timeline.
        const { x, y } = center(box);
        const litAt =
          CUES.Assemble +
          0.5 +
          (Math.hypot(x - timeline.x, y - timeline.y) / 1200) * 1.1;
        const lit = MOTION.enter(ramp(T - litAt, 0.6));
        const pulse = Math.sin(Math.PI * ramp(T - litAt, 0.7));
        const isTimeline = shot.name === "timeline";
        return (
          <div
            className="absolute box-border rounded-[14px] border bg-card shadow-xs"
            key={shot.name}
            style={{
              boxShadow: `0 0 0 ${pulse * 4}px color-mix(in oklab, var(--ring) ${30 * pulse}%, transparent)`,
              height: box.h,
              left: box.x,
              opacity:
                tw(
                  T,
                  reveal,
                  reveal + revealLength(index),
                  0,
                  1,
                  MOTION.enter
                ) * lerp(0.22, 1, Math.max(focus, lit)),
              overflow: isTimeline ? "hidden" : "visible",
              padding: isTimeline ? 0 : 16,
              top: box.y,
              transform: `translateY(${rises(index) * tw(T, reveal, reveal + 0.85, 14, 0, MOTION.enter)}px) scale(${1 - rises(index) * tw(T, reveal, reveal + 0.85, 0.03, 0, MOTION.enter)})`,
              width: box.w,
            }}
          >
            <Demo t={T - playAt(index)} />
          </div>
        );
      })}
      {/* The knob under the glyph, shown as the glyph lightens, alone until its panel has faded in round it. */}
      {T >= INTRO.back.start && T < revealAt(0) + revealLength(0) ? (
        <div
          className="absolute"
          style={{
            left: firstKnob(format).x - KNOB_SIZE / 2,
            opacity: 1 - darkAt(T),
            top: firstKnob(format).y - KNOB_SIZE / 2,
          }}
        >
          <Knob
            aria-label="Cutoff"
            max={1}
            min={0}
            size="lg"
            step={0.001}
            // The panel's own first knob, frame for frame: no jump when it takes over.
            style={knobRing(0, T - playAt(0))}
            value={knobValue(0, T - playAt(0))}
            valueLabel="hidden"
          />
        </div>
      ) : null}
    </div>
  );
}

/** The glyph, named, then lightened into the knob it stands for. */
function Intro({ T, cam, format }: { T: number; cam: Camera; format: Format }) {
  if (T >= INTRO.back.end) {
    return null;
  }
  const { H, W } = format.frame;
  const knob = firstKnob(format);
  // Wherever the camera puts the knob, the glyph and its name follow it.
  const x = (knob.x - cam.x) * cam.s + W / 2;
  const y = (knob.y - cam.y) * cam.s + H / 2;
  const size = (KNOB_SIZE * cam.s * 24) / 20;
  const appear = MOTION.enter(within(T, INTRO.appear));
  const cover = coverAt(T) * appear;
  const dark = darkAt(T);
  // Out of focus while it comes in, and again while it uncovers the knob.
  const blur = 6 * (1 - appear) + 2 * (1 - coverAt(T));
  return (
    <>
      {cover > 0 ? (
        <svg
          aria-hidden="true"
          className="absolute"
          height={size}
          style={{
            filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
            left: x,
            opacity: cover,
            top: y,
            // It settles clockwise, as a knob comes to rest.
            transform: `translate(-50%, -50%) rotate(${lerp(-24, 0, appear)}deg) scale(${lerp(0.94, 1, appear)})`,
          }}
          viewBox="0 0 24 24"
          width={size}
        >
          {/* The page under the slot: the knob's indicator never shows through. */}
          <circle cx={12} cy={12} fill="var(--background)" r={10} />
          <path
            d={LOGO_PATH}
            fill={`color-mix(in oklab, var(--foreground) ${100 * dark}%, var(--secondary))`}
          />
        </svg>
      ) : null}
      {/* The lockup's wordmark: as tall as the glyph, 0.2em after it, lifted onto its center. */}
      <div
        className="absolute flex h-0 items-center"
        style={{ left: x + size * 0.7, top: y }}
      >
        <div style={{ marginTop: size * -0.115 }}>
          <Rise
            leave={INTRO.leave - INTRO.word}
            size={GLYPH_SIZE}
            t={T - INTRO.word}
            text="audio/ui"
          />
        </div>
      </div>
    </>
  );
}

/** The logo and wordmark settle under the instrument, then the address types in. */
function Outro({ T, format }: { T: number; format: Format }) {
  if (T <= CUES.Outro) {
    return null;
  }
  const t = T - CUES.Outro;
  const land = MOTION.enter(ramp(t - 0.6, 0.55));
  return (
    <div
      className="absolute inset-x-0 flex flex-col items-center gap-5"
      style={{ top: format.outro.textY }}
    >
      <Lockup iconStyle={glyphEntrance(land)} size={104} t={t - 0.75} />
      <LockupUrl size={104} t={t - 1.5} text="https://audio-ui.dev" />
    </div>
  );
}

/**
 * The number and name of the panel the camera is on. It stays on screen from
 * the first panel to the last: between two, the number rolls to the next one
 * and the name crossfades, while the camera travels.
 */
function Label({ T, format }: { T: number; format: Format }) {
  const first = SHOTS[0] as Shot;
  const last = SHOTS.at(-1) as Shot;
  const shown =
    MOTION.enter(ramp(T - first.start - 0.35, 0.35)) *
    (1 - MOTION.enter(ramp(T - (last.start + last.length - 0.4), 0.3)));
  if (shown <= 0) {
    return null;
  }
  const upcoming = SHOTS.findIndex((each) => T < each.start);
  const index = Math.max(0, (upcoming === -1 ? SHOTS.length : upcoming) - 1);
  const shot = SHOTS[index] as Shot;
  const previous = index > 0 ? index - 1 : null;
  const swap =
    previous === null ? 1 : MOTION.move(ramp(T - shot.start - 0.15, 0.4));
  const number = (at: number) => String(at + 1).padStart(2, "0");
  const title = (at: number) => SHOWCASES[(SHOTS[at] as Shot).name]?.title;
  return (
    <div
      className="absolute flex items-baseline gap-4.5"
      style={{
        bottom: format.label[1],
        left: format.label[0],
        opacity: shown,
        transform: `translateY(${lerp(8, 0, shown)}px)`,
      }}
    >
      {/* The number rolls up through a one-line window. */}
      <span className="relative inline-block overflow-hidden font-mono text-muted-foreground text-xl leading-none tabular-nums">
        <span className="invisible">{number(index)}</span>
        {previous === null ? null : (
          <span
            className="absolute inset-0"
            style={{ transform: `translateY(${-100 * swap}%)` }}
          >
            {number(previous)}
          </span>
        )}
        <span
          className="absolute inset-0"
          style={{ transform: `translateY(${100 * (1 - swap)}%)` }}
        >
          {number(index)}
        </span>
      </span>
      {/* The names share one cell and crossfade, blurred so the two read as one change. */}
      <span className="grid font-medium text-[40px] tracking-tight">
        {previous === null ? null : (
          <span
            className="[grid-area:1/1]"
            style={{ filter: `blur(${2 * swap}px)`, opacity: 1 - swap }}
          >
            {title(previous)}
          </span>
        )}
        <span
          className="[grid-area:1/1]"
          style={{ filter: `blur(${2 * (1 - swap)}px)`, opacity: swap }}
        >
          {title(index)}
        </span>
      </span>
    </div>
  );
}

function Scene({ T, format }: { T: number; format: Format }) {
  const cam = camera(T, format);
  return (
    <div className="absolute inset-0 overflow-hidden bg-background font-sans text-foreground antialiased">
      <Instrument cam={cam} format={format} T={T} />
      <Intro cam={cam} format={format} T={T} />
      <Outro format={format} T={T} />
      {/* Keeps the labels legible over the panels the camera passes. */}
      <div
        className="absolute inset-x-0 bottom-0 h-72 bg-linear-to-t from-background via-background/80 to-transparent"
        style={{
          opacity: Math.min(
            ramp(T - CUES.Controls, 0.5),
            1 - ramp(T - CUES.Assemble, 0.6)
          ),
        }}
      />
      <Label format={format} T={T} />
    </div>
  );
}

/**
 * The library in 28 seconds: the controls one by one, then the editors, then
 * the camera pulls back on the whole instrument while it turns dark.
 */
export function Teaser() {
  const T = useSeconds();
  const format = LANDSCAPE;
  const wipe = MOTION.move(ramp(T - (CUES.Assemble + 2.7), 1.2));
  return (
    <div className="style-vega absolute inset-0 overflow-hidden">
      {wipe < 1 ? <Scene format={format} T={T} /> : null}
      {wipe > 0 ? (
        // The dark theme spreads from the center: the same scene, under `.dark`.
        <div
          className="dark absolute inset-0"
          style={{
            clipPath:
              wipe < 1
                ? `circle(${wipe * format.wipeRadius}px at 50% 50%)`
                : undefined,
          }}
        >
          <Scene format={format} T={T} />
        </div>
      ) : null}
    </div>
  );
}
