import type { CSSProperties } from "react";
import { MOTION, ramp } from "./motion.ts";

/** The slot cut through the glyph, in degrees clockwise from 12 o'clock: where its knob points. */
export const LOGO_NOTCH_ANGLE = 30;

/** The outline of the site's glyph (`Icons.audioUi`), on a 24-unit square. */
export const LOGO_PATH =
  "M13.799 11.884L18.243 4.188A10 10 0 1 1 15.645 2.688L11.201 10.384Z";

/** The site's glyph: a knob at the end of its sweep. */
export function Logo({ size, style }: { size: number; style?: CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      className="block fill-current"
      height={size}
      style={style}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d={LOGO_PATH} />
    </svg>
  );
}

/**
 * `text` in the serif, each letter rising out of a mask from `t` = 0 and,
 * with `leave`, the whole word fading out from there, in one piece. The
 * wordmark is `"audio/ui"`.
 */
export function Rise({
  leave,
  size,
  t,
  text,
}: {
  leave?: number;
  size: number;
  t: number;
  text: string;
}) {
  // Out faster than in, and blurred so it reads as one fade, not letters vanishing.
  const out = leave === undefined ? 0 : MOTION.enter(ramp(t - leave, 0.35));
  return (
    <div
      className="flex overflow-hidden whitespace-nowrap font-serif leading-none"
      style={{
        fontSize: size,
        marginBottom: -size * 0.16,
        filter: out > 0 ? `blur(${4 * out}px)` : undefined,
        opacity: 1 - out,
        paddingBottom: size * 0.16,
        transform: `translateY(${-0.06 * size * out}px)`,
      }}
    >
      {[...text].map((letter, index) => {
        const rise = MOTION.enter(ramp(t - index * 0.04, 0.6));
        return (
          <span
            className="inline-block"
            // biome-ignore lint/suspicious/noArrayIndexKey: a letter never moves within the text
            key={index}
            style={{
              transform: `translateY(${(1 - rise) * 115}%)`,
            }}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
}

const CHARACTERS_PER_SECOND = 30;
const BLINKS_PER_SECOND = 2.4;

/** Text typed in from `t` = 0, the caret blinking once it is done. */
export function Typed({
  caretHeight,
  t,
  text,
}: {
  caretHeight: number;
  t: number;
  text: string;
}) {
  const shown = Math.floor(Math.max(t, 0) * CHARACTERS_PER_SECOND);
  const done = shown >= text.length;
  const blinkOn = Math.floor(t * BLINKS_PER_SECOND) % 2 === 0;
  return (
    <span className="relative inline-flex items-center whitespace-pre">
      <span>{text.slice(0, shown)}</span>
      {/* Out of the flow: the text alone sets the width, the caret follows it. */}
      <span
        className="-translate-y-1/2 absolute top-1/2 left-full ml-1 w-0.5 bg-foreground"
        style={{
          height: caretHeight,
          opacity: t < 0 || (done && !blinkOn) ? 0.15 : 1,
        }}
      />
    </span>
  );
}

/**
 * The glyph and "audio/ui" side by side, in the site header's proportions: the
 * glyph as tall as the text, 0.2em apart, the serif lifted 0.115em so it sits
 * on the glyph's center. Letters rise from `t` when it is given.
 */
export function Lockup({
  iconStyle,
  size,
  t = Number.POSITIVE_INFINITY,
}: {
  iconStyle?: CSSProperties;
  size: number;
  t?: number;
}) {
  return (
    <div className="flex items-center" style={{ gap: size * 0.2 }}>
      <Logo size={size} style={iconStyle} />
      <div style={{ marginTop: size * -0.115 }}>
        <Rise size={size} t={t} text="audio/ui" />
      </div>
    </div>
  );
}

/** "audio/ui" in Instrument Serif, in em. */
const WORDMARK_EM = 2.916;
/** Every Geist Mono character, in em. */
const MONO_ADVANCE_EM = 0.6;

/**
 * An address typed under a `Lockup` of the same `size`, set to span exactly
 * what the lockup shows: from the glyph's disc (2 of its 24 units are margin)
 * to the end of the wordmark. It types from that box's left edge.
 */
export function LockupUrl({
  size,
  t,
  text,
}: {
  size: number;
  t: number;
  text: string;
}) {
  const ink = size * (1.2 + WORDMARK_EM - 1 / 12);
  const fontSize = ink / (text.length * MONO_ADVANCE_EM);
  return (
    <div
      className="font-mono text-muted-foreground leading-none"
      // The lockup is centered with the glyph's margin: shift by half of it.
      style={{ fontSize, transform: `translateX(${size / 24}px)`, width: ink }}
    >
      <Typed caretHeight={fontSize * 1.05} t={t} text={text} />
    </div>
  );
}
