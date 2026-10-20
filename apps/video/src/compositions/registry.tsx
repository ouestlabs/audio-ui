import { cn } from "@/registry/bases/base/lib/utils";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import { glyphEntrance, Lockup, LockupUrl, Typed } from "../brand.tsx";
import {
  activeRing,
  clamp,
  lerp,
  MOTION,
  pressed,
  ramp,
  tw,
  useSeconds,
} from "../motion.ts";

export const REGISTRY_SECONDS = 10.6;

const COMMAND = "npx shadcn@latest add @audio-ui/knob";
const TYPED_AT = 0.75;
/** The command is in at 30 characters a second; Enter a beat later. */
const ENTER_AT = TYPED_AT + COMMAND.length / 30 + 0.45;
const OUTPUT = [
  { at: 0.15, check: true, text: "Checking registry." },
  { at: 0.6, check: true, text: "Installing dependencies." },
  { at: 1.1, check: true, text: "Created 1 file:" },
  { at: 1.25, check: false, text: "  - components/audio-ui/knob.tsx" },
];
/** The window opens a pane under the output, and the knob comes into it. */
const OPEN_AT = ENTER_AT + 1.9;
const TURN_AT = OPEN_AT + 0.9;
const LEAVE_AT = REGISTRY_SECONDS - 2.3;

const WIDTH = 1560;
const TERMINAL_HEIGHT = 520;
const PANE_HEIGHT = 420;

const hertz = (value: number) => {
  const frequency = 20 * 1000 ** value;
  return frequency >= 1000
    ? `${(frequency / 1000).toFixed(1)} kHz`
    : `${Math.round(frequency)} Hz`;
};

/** The knob, turned by a hand at `TURN_AT`, then drifting round where it was set. */
function knobValue(T: number) {
  const turned = tw(T, TURN_AT, TURN_AT + 1.1, 0.18, 0.78, MOTION.enter);
  const drift =
    0.06 * Math.sin((T - TURN_AT - 1.2) * 1.7) * ramp(T - TURN_AT - 1, 0.8);
  return clamp(turned + drift, 0, 1);
}

/** One line the CLI prints, rising in at its time. */
function OutputLine({
  check,
  t,
  text,
}: {
  check: boolean;
  t: number;
  text: string;
}) {
  const shown = MOTION.enter(ramp(t, 0.35));
  if (t < 0) {
    return null;
  }
  return (
    <div
      className="flex gap-4 whitespace-pre"
      style={{
        opacity: shown,
        transform: `translateY(${(1 - shown) * 8}px)`,
      }}
    >
      {check ? <span className="text-success">✔</span> : null}
      <span className={check ? undefined : "text-muted-foreground"}>
        {text}
      </span>
    </div>
  );
}

/**
 * One window: the command typed in a terminal, what the CLI prints, then the
 * window grows a pane under it where the installed knob turns. The pane is the
 * same window opening, not a second one.
 */
function Window({ T }: { T: number }) {
  const shown = MOTION.enter(ramp(T, 0.6));
  const gone = MOTION.enter(ramp(T - LEAVE_AT, 0.35));
  const open = tw(T, OPEN_AT, OPEN_AT + 0.7, 0, 1, MOTION.move);
  const knobIn = MOTION.enter(ramp(T - OPEN_AT - 0.35, 0.6));
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl"
      style={{
        filter: gone > 0 ? `blur(${6 * gone}px)` : undefined,
        height: TERMINAL_HEIGHT + PANE_HEIGHT * open,
        opacity: shown * (1 - gone),
        transform: `translateY(${lerp(24, 0, shown) - 16 * gone}px) scale(${lerp(0.97, 1, shown)})`,
        width: WIDTH,
      }}
    >
      <div className="flex h-18 items-center gap-3 border-b px-8">
        <span className="size-4.5 rounded-full bg-muted-foreground/25" />
        <span className="size-4.5 rounded-full bg-muted-foreground/25" />
        <span className="size-4.5 rounded-full bg-muted-foreground/25" />
        <span className="ml-5 font-mono text-2xl text-muted-foreground">
          ~/my-app
        </span>
      </div>
      <div
        className="flex flex-col gap-4 px-12 pt-11 font-mono text-[42px] leading-tight"
        style={{ height: TERMINAL_HEIGHT - 72 }}
      >
        <div className="flex gap-4 whitespace-pre">
          <span className="text-muted-foreground">$</span>
          {/* The caret leaves once Enter is pressed. */}
          {T < ENTER_AT ? (
            <Typed caretHeight={46} t={T - TYPED_AT} text={COMMAND} />
          ) : (
            <span>{COMMAND}</span>
          )}
        </div>
        {OUTPUT.map((line) => (
          <OutputLine
            check={line.check}
            key={line.text}
            t={T - ENTER_AT - line.at}
            text={line.text}
          />
        ))}
      </div>
      <div
        className="flex items-center justify-center border-t bg-muted/40"
        style={{ height: PANE_HEIGHT }}
      >
        <div
          className="flex flex-col items-center gap-3"
          style={{
            opacity: knobIn,
            transform: `translateY(${(1 - knobIn) * 14}px) scale(2.2)`,
          }}
        >
          <span className="text-muted-foreground text-sm">Cutoff</span>
          <Knob
            aria-label="Cutoff"
            formatValue={hertz}
            max={1}
            min={0}
            size="xl"
            step={0.001}
            style={activeRing(pressed(T, TURN_AT, 1.1))}
            value={knobValue(T)}
            valueLabel="always"
          />
        </div>
      </div>
    </div>
  );
}

/** The site, its logo and address, once the window has left. */
function Signoff({ T }: { T: number }) {
  const t = T - LEAVE_AT - 0.1;
  const land = MOTION.enter(ramp(t, 0.55));
  if (t < 0) {
    return null;
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
      <Lockup iconStyle={glyphEntrance(land)} size={120} t={t - 0.15} />
      <LockupUrl size={120} t={t - 0.35} text="https://audio-ui.dev" />
    </div>
  );
}

/** audio/ui from the shadcn CLI: one command, and the knob it installs, turning. */
export function Registry({ theme }: { theme: "dark" | "light" }) {
  const T = useSeconds();
  return (
    <div
      className={cn(
        "style-vega absolute inset-0 flex items-center justify-center overflow-hidden bg-background font-sans text-foreground antialiased",
        theme === "dark" && "dark"
      )}
    >
      {T < LEAVE_AT + 0.4 ? <Window T={T} /> : null}
      <Signoff T={T} />
    </div>
  );
}
