import { ArrowUpIcon, MousePointer2Icon, SparklesIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Knob } from "@/registry/bases/shared/audio-ui/elements/knob";
import { cn } from "@/registry/lib/utils";

import { glyphEntrance, Lockup, LockupUrl, Typed } from "../brand.tsx";
import {
  activeRing,
  lerp,
  MOTION,
  pressed,
  ramp,
  tw,
  useSeconds,
} from "../motion.ts";

export const THIRD_USER_SECONDS = 16.3;

export type ThirdUserLang = "en" | "fr";

/** Typed text runs at this speed in `Typed`. */
const CHARACTERS_PER_SECOND = 30;
const typingSeconds = (text: string) => text.length / CHARACTERS_PER_SECOND;

/** What is asked of the agent, in the language of the post the video goes with. */
const ASKS = {
  en: {
    build: "Add a filter with cutoff and resonance",
    drive: "Open the filter up, more resonance",
    placeholder: "Ask the agent",
  },
  fr: {
    build: "Ajoute un filtre avec cutoff et résonance",
    drive: "Ouvre le filtre, avec plus de résonance",
    placeholder: "Demande à l'agent",
  },
} satisfies Record<ThirdUserLang, Record<string, string>>;

/** The longest typing of a request across languages: both videos keep the same cues. */
const longestTyping = (key: "build" | "drive") =>
  Math.max(...Object.values(ASKS).map((asks) => typingSeconds(asks[key])));

/** The code the agent writes: the knobs it adds, each named for what it sets. */
const CODE = [
  '<Knob aria-label="Cutoff" />',
  '<Knob aria-label="Resonance" />',
];

/** Where each knob sits before anyone turns it, where a hand leaves the cutoff, and where the agent sets both. */
const CUTOFF = { start: 0.35, hand: 0.5, agent: 0.7 };
const RESONANCE = { start: 0.2, agent: 0.6 };

const SEND_DELAY = 0.35;
const ASK_BUILD_AT = 0.9;
const SEND_BUILD_AT = ASK_BUILD_AT + longestTyping("build") + SEND_DELAY;
const CODE_AT = SEND_BUILD_AT + 0.55;
const CODE_LINE_GAP = 0.12;
const codeSeconds = (lines: string[]) =>
  lines.reduce((total, line) => total + typingSeconds(line) + CODE_LINE_GAP, 0);
const CODE_LINE_AT = CODE.map(
  (_, index) => CODE_AT + codeSeconds(CODE.slice(0, index))
);
const KNOBS_AT = CODE_AT + codeSeconds(CODE) + 0.15;
const HAND_PRESS_AT = KNOBS_AT + 1.3;
const HAND_HOLD = 1.1;
const ASK_DRIVE_AT = HAND_PRESS_AT + HAND_HOLD + 0.7;
const SEND_DRIVE_AT = ASK_DRIVE_AT + longestTyping("drive") + SEND_DELAY;
const CUTOFF_TOOL_AT = SEND_DRIVE_AT + 0.45;
const RESONANCE_TOOL_AT = CUTOFF_TOOL_AT + 0.5;
const TOOL_HOLD = 1.1;
const LEAVE_AT = THIRD_USER_SECONDS - 2.7;

const WIDTH = 1800;
const HEIGHT = 960;
const TITLE_BAR = 72;
const CHAT_WIDTH = 790;

const hertz = (value: number, decimal: string) => {
  const frequency = 20 * 1000 ** value;
  return frequency >= 1000
    ? `${(frequency / 1000).toFixed(1).replace(".", decimal)} kHz`
    : `${Math.round(frequency)} Hz`;
};

/** The values as each language writes them: 2.5 kHz and 60% in English, 2,5 kHz and 60 % in French. */
const FORMATS = {
  en: {
    cutoff: (value: number) => hertz(value, "."),
    resonance: (value: number) => `${Math.round(value * 100)}%`,
  },
  fr: {
    cutoff: (value: number) => hertz(value, ","),
    resonance: (value: number) => `${Math.round(value * 100)} %`,
  },
} satisfies Record<ThirdUserLang, Record<string, (value: number) => string>>;

type Formats = (typeof FORMATS)[ThirdUserLang];

function cutoffAt(T: number) {
  if (T < CUTOFF_TOOL_AT) {
    return tw(
      T,
      HAND_PRESS_AT,
      HAND_PRESS_AT + HAND_HOLD,
      CUTOFF.start,
      CUTOFF.hand,
      MOTION.enter
    );
  }
  return tw(
    T,
    CUTOFF_TOOL_AT,
    CUTOFF_TOOL_AT + TOOL_HOLD,
    CUTOFF.hand,
    CUTOFF.agent,
    MOTION.move
  );
}

const resonanceAt = (T: number) =>
  tw(
    T,
    RESONANCE_TOOL_AT,
    RESONANCE_TOOL_AT + TOOL_HOLD,
    RESONANCE.start,
    RESONANCE.agent,
    MOTION.move
  );

/** Comes in rising a little and coming into focus at `at`. */
function Appear({
  at,
  children,
  className,
  T,
}: {
  at: number;
  children: ReactNode;
  className?: string;
  T: number;
}) {
  const shown = MOTION.enter(ramp(T - at, 0.5));
  if (shown <= 0) {
    return null;
  }
  const style: CSSProperties = {
    filter: shown < 1 ? `blur(${6 * (1 - shown)}px)` : undefined,
    opacity: shown,
    transform: `translateY(${(1 - shown) * 14}px)`,
  };
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

/** What was asked, once sent: a bubble on the right of the chat. */
function AskBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[600px] rounded-3xl rounded-br-lg bg-muted px-7 py-5 leading-snug"
        style={{ fontSize: 36 }}
      >
        {text}
      </div>
    </div>
  );
}

/** A line of code typed in, plain once the next line starts. */
function CodeLine({ at, T, text }: { at: number; T: number; text: string }) {
  const t = T - at;
  if (t < 0) {
    return <div className="h-[1.4em]" />;
  }
  if (t < typingSeconds(text) + CODE_LINE_GAP) {
    return (
      <div className="h-[1.4em] whitespace-pre">
        <Typed caretHeight={36} t={t} text={text} />
      </div>
    );
  }
  return <div className="h-[1.4em] whitespace-pre">{text}</div>;
}

/** One thing the agent did through a control, by the control's name: the knob and the value it set. */
function ToolLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center gap-3 font-mono text-muted-foreground"
      style={{ fontSize: 30 }}
    >
      <span className="text-foreground">{label}</span>
      <span>→</span>
      <span className="text-foreground tabular-nums">{value}</span>
    </div>
  );
}

/** The agent's turn in the chat: its glyph, then what it wrote or did. */
function AgentTurn({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="mt-1 flex size-13 shrink-0 items-center justify-center rounded-full border bg-background">
        <SparklesIcon aria-hidden="true" size={26} strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </div>
  );
}

/** The request being typed at `T`, if one is. */
function typingAt(T: number, lang: ThirdUserLang) {
  const asks = ASKS[lang];
  if (T >= ASK_BUILD_AT && T < SEND_BUILD_AT) {
    return { at: ASK_BUILD_AT, text: asks.build };
  }
  if (T >= ASK_DRIVE_AT && T < SEND_DRIVE_AT) {
    return { at: ASK_DRIVE_AT, text: asks.drive };
  }
  return null;
}

/** The chat's input: the placeholder, then the request being typed, empty again once it is sent. */
function ChatInput({ lang, T }: { lang: ThirdUserLang; T: number }) {
  const typing = typingAt(T, lang);
  const sending = Math.max(
    pressed(T, SEND_BUILD_AT - 0.2, 0.15),
    pressed(T, SEND_DRIVE_AT - 0.2, 0.15)
  );
  return (
    <div
      className="flex items-center gap-4 rounded-3xl border bg-background py-4 pr-4 pl-8"
      style={{ fontSize: 34 }}
    >
      <div className="min-w-0 flex-1 truncate">
        {typing ? (
          <Typed caretHeight={40} t={T - typing.at} text={typing.text} />
        ) : (
          <span className="text-muted-foreground">
            {ASKS[lang].placeholder}
          </span>
        )}
      </div>
      <span
        className={cn(
          "flex size-15 shrink-0 items-center justify-center rounded-full",
          typing
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground"
        )}
        style={{ transform: `scale(${1 - 0.08 * sending})` }}
      >
        <ArrowUpIcon aria-hidden="true" size={30} strokeWidth={2.25} />
      </span>
    </div>
  );
}

/** The agent's side: what it is asked, the code it writes, and what it sets. */
function Chat({
  formats,
  lang,
  T,
}: {
  formats: Formats;
  lang: ThirdUserLang;
  T: number;
}) {
  const asks = ASKS[lang];
  return (
    <div
      className="flex h-full shrink-0 flex-col justify-between border-r bg-muted/30 p-10"
      style={{ width: CHAT_WIDTH }}
    >
      <div className="flex flex-col gap-7">
        <Appear at={SEND_BUILD_AT} T={T}>
          <AskBubble text={asks.build} />
        </Appear>
        <Appear at={CODE_AT - 0.3} T={T}>
          <AgentTurn>
            <div
              className="rounded-2xl border bg-background px-6 py-5 font-mono leading-none"
              style={{ fontSize: 30 }}
            >
              {CODE.map((line, index) => (
                <CodeLine
                  at={CODE_LINE_AT[index] ?? CODE_AT}
                  key={line}
                  T={T}
                  text={line}
                />
              ))}
            </div>
          </AgentTurn>
        </Appear>
        <Appear at={SEND_DRIVE_AT} T={T}>
          <AskBubble text={asks.drive} />
        </Appear>
        <Appear at={CUTOFF_TOOL_AT - 0.2} T={T}>
          <AgentTurn>
            <ToolLine label="Cutoff" value={formats.cutoff(CUTOFF.agent)} />
            <Appear at={RESONANCE_TOOL_AT - 0.2} T={T}>
              <ToolLine
                label="Resonance"
                value={formats.resonance(RESONANCE.agent)}
              />
            </Appear>
          </AgentTurn>
        </Appear>
      </div>
      <ChatInput lang={lang} T={T} />
    </div>
  );
}

/** The pointer that turns the cutoff by hand: it comes in, drags upward, and leaves. */
function Pointer({ T }: { T: number }) {
  const t = T - HAND_PRESS_AT;
  const shown =
    MOTION.enter(ramp(t + 0.6, 0.5)) *
    (1 - MOTION.enter(ramp(t - HAND_HOLD - 0.25, 0.4)));
  if (shown <= 0) {
    return null;
  }
  const arrive = MOTION.enter(ramp(t + 0.6, 0.6));
  const lift = tw(t, 0, HAND_HOLD, 0, -60, MOTION.enter);
  return (
    <div
      className="pointer-events-none absolute text-foreground"
      style={{
        left: "50%",
        opacity: shown,
        top: "50%",
        transform: `translate(${lerp(170, 70, arrive)}px, ${lerp(180, 20, arrive) + lift}px)`,
      }}
    >
      <MousePointer2Icon
        aria-hidden="true"
        className="fill-background"
        size={66}
        strokeWidth={1.5}
      />
    </div>
  );
}

/** A knob of the filter, labelled as the agent named it, at the size of a panel seen up close. */
function FilterKnob({
  children,
  formatValue,
  label,
  ring,
  value,
}: {
  children?: ReactNode;
  formatValue: (value: number) => string;
  label: string;
  ring: number;
  value: number;
}) {
  return (
    <div className="relative flex h-[470px] w-[340px] items-center justify-center">
      <div
        className="flex flex-col items-center gap-3"
        style={{ transform: "scale(2.7)" }}
      >
        <span className="text-sm text-muted-foreground">{label}</span>
        <Knob
          aria-label={label}
          formatValue={formatValue}
          max={1}
          min={0}
          size="xl"
          step={0.001}
          style={activeRing(ring)}
          value={value}
          valueLabel="always"
        />
      </div>
      {children}
    </div>
  );
}

/** The app the agent builds into: empty, then the filter it wrote, turned by a hand and by the agent. */
function App({ formats, T }: { formats: Formats; T: number }) {
  const cutoffRing = Math.max(
    pressed(T, HAND_PRESS_AT, HAND_HOLD),
    pressed(T, CUTOFF_TOOL_AT, TOOL_HOLD)
  );
  const resonanceRing = pressed(T, RESONANCE_TOOL_AT, TOOL_HOLD);
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <div className="flex items-center gap-10">
        <Appear at={KNOBS_AT} T={T}>
          <FilterKnob
            formatValue={formats.cutoff}
            label="Cutoff"
            ring={cutoffRing}
            value={cutoffAt(T)}
          >
            <Pointer T={T} />
          </FilterKnob>
        </Appear>
        <Appear at={KNOBS_AT + 0.15} T={T}>
          <FilterKnob
            formatValue={formats.resonance}
            label="Resonance"
            ring={resonanceRing}
            value={resonanceAt(T)}
          />
        </Appear>
      </div>
    </div>
  );
}

/** One window: the agent on the left, the app on the right, entering together and leaving in one piece. */
function Window({ lang, T }: { lang: ThirdUserLang; T: number }) {
  const shown = MOTION.enter(ramp(T, 0.6));
  const gone = MOTION.enter(ramp(T - LEAVE_AT, 0.35));
  const formats = FORMATS[lang];
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl"
      style={{
        filter: gone > 0 ? `blur(${6 * gone}px)` : undefined,
        height: HEIGHT,
        opacity: shown * (1 - gone),
        transform: `translateY(${lerp(24, 0, shown) - 16 * gone}px) scale(${lerp(0.97, 1, shown)})`,
        width: WIDTH,
      }}
    >
      <div
        className="flex items-center gap-3 border-b px-8"
        style={{ height: TITLE_BAR }}
      >
        <span className="size-4.5 rounded-full bg-muted-foreground/25" />
        <span className="size-4.5 rounded-full bg-muted-foreground/25" />
        <span className="size-4.5 rounded-full bg-muted-foreground/25" />
        <span className="ml-5 font-mono text-[28px] text-muted-foreground">
          ~/my-synth
        </span>
      </div>
      <div className="flex" style={{ height: HEIGHT - TITLE_BAR }}>
        <Chat formats={formats} lang={lang} T={T} />
        <App formats={formats} T={T} />
      </div>
    </div>
  );
}

/** The logo and the site's address, once the window has left: how every video ends. */
function Signoff({ T }: { T: number }) {
  const t = T - LEAVE_AT - 0.1;
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
      <LockupUrl size={120} t={t - 0.35} text="https://audio-ui.dev" />
    </div>
  );
}

/**
 * The third user, shown rather than told: an agent writes a filter's knobs
 * into an app, a hand turns one, then the agent, asked in words, turns both
 * by their names, wearing the same ring as the hand.
 */
export function ThirdUser({
  lang,
  theme,
}: {
  lang: ThirdUserLang;
  theme: "dark" | "light";
}) {
  const T = useSeconds();
  return (
    <div
      className={cn(
        "style-vega absolute inset-0 flex items-center justify-center overflow-hidden bg-background font-sans text-foreground antialiased",
        theme === "dark" && "dark"
      )}
    >
      {T < LEAVE_AT + 0.4 ? <Window lang={lang} T={T} /> : null}
      <Signoff T={T} />
    </div>
  );
}
