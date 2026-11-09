import { StarIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { glyphEntrance, Lockup, LockupUrl } from "../brand.tsx";
import { MOTION, ramp, useSeconds } from "../motion.ts";

export const STARS_SECONDS = 7.5;

/** How long the number takes to count up. */
const COUNT_SECONDS = 2;

/**
 * The number comes in and counts with what it counts, the thanks follow once
 * it lands, then the card leaves for the logo and the address, as every video ends.
 */
const CUES = {
  count: 0.2,
  label: 0.3,
  thanks: 0.2 + COUNT_SECONDS + 0.1,
  leave: STARS_SECONDS - 2.65,
};

/**
 * The card's three lines fill one box: the label and the thanks are set as
 * wide as the star and the number. Widths of their ink, measured on a render:
 * the row's in px (a 220px star, 240px digits), the lines' in em of their size.
 */
const ROW_INK = 545;
const LABEL_INK_EM = 384 / 56;
const THANKS_INK_EM = 379 / 104;

/** Every line comes in the same way: it rises a little and comes into focus. */
function Enter({
  at,
  children,
  T,
}: {
  at: number;
  children: ReactNode;
  T: number;
}) {
  const shown = MOTION.enter(ramp(T - at, 0.8));
  return (
    <div
      style={{
        filter: shown < 1 ? `blur(${8 * (1 - shown)}px)` : undefined,
        opacity: shown,
        transform: `translateY(${(1 - shown) * 24}px)`,
      }}
    >
      {children}
    </div>
  );
}

/** The number at `t`: up from 0, slow while its line comes in, fast, then slowing as it lands on `to`. */
const countAt = (t: number, to: number) =>
  Math.round(to * MOTION.move(ramp(t, COUNT_SECONDS)));

/**
 * How many digits the number has, averaged over the last quarter second: when
 * it gains one, its box widens smoothly and the row re-centers without a jump.
 */
const digitsAt = (t: number, to: number) => {
  const samples = Array.from(
    { length: 16 },
    (_, index) => String(countAt(t - (index * 0.25) / 15, to)).length
  );
  return samples.reduce((sum, digits) => sum + digits, 0) / samples.length;
};

/**
 * The number counting up. Its box is as wide as its digits (`ch` is a digit's
 * width in the font), so it stays against the star and the pair stays centered.
 */
function Counter({ t, to }: { t: number; to: number }) {
  return (
    <div
      className="whitespace-nowrap font-serif leading-none tabular-nums"
      style={{ fontSize: 240, width: `${digitsAt(t, to)}ch` }}
    >
      {countAt(t, to)}
    </div>
  );
}

/** The star and the number, what they count and the thanks, in one box; it leaves in one piece. */
function Card({ stars, T }: { stars: number; T: number }) {
  const gone = MOTION.enter(ramp(T - CUES.leave, 0.35));
  if (gone >= 1) {
    return null;
  }
  return (
    // Raised 28px: its ink, the "y" of the thanks included, sits centered in the frame.
    <div
      className="-mt-7 flex flex-col items-center"
      style={{
        filter: gone > 0 ? `blur(${6 * gone}px)` : undefined,
        opacity: 1 - gone,
        transform: `translateY(${-16 * gone}px)`,
      }}
    >
      <Enter at={CUES.count} T={T}>
        {/* The last digit's side bearing leaves the ink 10px short of its box: centered on the ink. */}
        <div
          className="flex items-center gap-7"
          style={{ transform: "translateX(5px)" }}
        >
          <StarIcon
            aria-hidden="true"
            className="fill-current"
            size={220}
            strokeWidth={1}
          />
          <Counter t={T - CUES.count} to={stars} />
        </div>
      </Enter>
      <div className="mt-6">
        <Enter at={CUES.label} T={T}>
          <div
            className="text-muted-foreground leading-none tracking-tight"
            style={{ fontSize: ROW_INK / LABEL_INK_EM }}
          >
            stars on GitHub
          </div>
        </Enter>
      </div>
      <div className="mt-14">
        <Enter at={CUES.thanks} T={T}>
          <div
            className="font-serif leading-none"
            style={{ fontSize: ROW_INK / THANKS_INK_EM }}
          >
            Thank you
          </div>
        </Enter>
      </div>
    </div>
  );
}

/** The logo and the repository's address, once the card is gone (never over it): how every video ends. */
function Signoff({ T }: { T: number }) {
  const t = T - CUES.leave - 0.35;
  if (t < 0) {
    return null;
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
      <Lockup
        iconStyle={glyphEntrance(MOTION.enter(ramp(t, 0.55)))}
        size={120}
        t={t - 0.15}
      />
      <LockupUrl size={120} t={t - 0.35} text="github.com/ouestlabs/audio-ui" />
    </div>
  );
}

/** A thank you for a GitHub milestone: the star and the number, the thanks, then the logo and where the repository is. */
export function Stars({
  stars,
  theme,
}: {
  stars: number;
  theme: "dark" | "light";
}) {
  const T = useSeconds();
  return (
    <div
      className={cn(
        "style-vega absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-background font-sans text-foreground antialiased",
        theme === "dark" && "dark"
      )}
    >
      <Card stars={stars} T={T} />
      <Signoff T={T} />
    </div>
  );
}
