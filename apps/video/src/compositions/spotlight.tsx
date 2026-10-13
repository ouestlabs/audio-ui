import { cn } from "@/registry/bases/base/lib/utils";
import {
  glyphEntrance,
  Lockup,
  LockupUrl,
  MONO_ADVANCE_EM,
  Rise,
  Typed,
} from "../brand.tsx";
import { lerp, MOTION, ramp, tw, useSeconds } from "../motion.ts";
import { SHOWCASES } from "../showcases/index.ts";

export const SPOTLIGHT_SECONDS = 10;

export interface SpotlightProps {
  /** One line on what it is: the docs page's `description`. */
  description: string;
  /** A component the library didn't have, changes to one it has, or the component as it is (no status). */
  kind: "new" | "showcase" | "update";
  /** Its registry name, such as `"knob"`: the key of its showcase and of its install command. */
  name: string;
  /** What changed, one line each: shown for an update. */
  notes: string[];
  theme: "dark" | "light";
  title: string;
  /** The version of `@audio-ui/react` it ships in. */
  version: string;
  [key: string]: unknown;
}

export const SPOTLIGHT_DEFAULTS: SpotlightProps = {
  description:
    "A rotary control for continuous parameters, with pointer, wheel and keyboard input.",
  kind: "new",
  name: "knob",
  notes: [
    "Marks around the dial, with labels",
    "Type a value in the readout",
    "Log and custom scales",
  ],
  theme: "light",
  title: "Knob",
  version: "0.2.0",
};

const LEAVE_AT = SPOTLIGHT_SECONDS - 2.4;
/** Width over height from which a component is laid out under the text, across the frame. */
const WIDE_RATIO = 2.5;
/** How far everything has left: out faster than in, starting at once. */
const goneAt = (T: number) => MOTION.enter(ramp(T - LEAVE_AT, 0.35));

/** Fades and lifts in from `start`, and every part leaves together at the end. */
function useEnter(T: number, start: number) {
  const shown = tw(T, start, start + 0.6, 0, 1, MOTION.enter);
  const gone = goneAt(T);
  return {
    opacity: shown * (1 - gone),
    transform: `translateY(${lerp(16, 0, shown) - 24 * gone}px)`,
  };
}

/**
 * "New component" or "Updated" and the version, after the logo, behind a thin
 * rule. A plain showcase has no status: the logo stands alone.
 */
function Status({
  T,
  kind,
  version,
}: {
  T: number;
  kind: SpotlightProps["kind"];
  version: string;
}) {
  const entrance = useEnter(T, 0.3);
  if (kind === "showcase") {
    return null;
  }
  return (
    <div className="flex items-center gap-5" style={entrance}>
      {/* A rule, not a slash: the wordmark has one already. */}
      <span aria-hidden="true" className="h-8 w-px bg-border" />
      <span className="flex items-baseline gap-3 text-[28px]">
        <span className="font-medium">
          {kind === "new" ? "New component" : "Updated"}
        </span>
        <span className="font-mono text-2xl text-muted-foreground">
          {version}
        </span>
      </span>
    </div>
  );
}

function Notes({ T, notes }: { T: number; notes: string[] }) {
  const card = useEnter(T, 1.9);
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border bg-card p-7 shadow-xs"
      style={card}
    >
      <span className="font-medium text-muted-foreground text-xl">
        What changed
      </span>
      {notes.map((note, index) => {
        const line = tw(
          T,
          2.2 + index * 0.25,
          2.8 + index * 0.25,
          0,
          1,
          MOTION.enter
        );
        return (
          <div
            className="flex items-baseline gap-4 text-[28px] leading-snug"
            key={note}
            style={{
              opacity: line,
              transform: `translateX(${lerp(-12, 0, line)}px)`,
            }}
          >
            <span className="font-mono text-info">+</span>
            <span>{note}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The text column's width, in px (`w-170`). */
const COLUMN_WIDTH = 680;
/** The command box's padding, its prompt, the gap and the caret's room, in px. */
const INSTALL_CHROME = 56 + 16 + 8;
const INSTALL_FONT_SIZE = 26;

function Install({
  T,
  command,
  start,
}: {
  T: number;
  command: string;
  start: number;
}) {
  // A long component name shrinks the command until it fits its box.
  const fontSize = Math.min(
    INSTALL_FONT_SIZE,
    (COLUMN_WIDTH - INSTALL_CHROME) / (MONO_ADVANCE_EM * (command.length + 1))
  );
  return (
    <div
      className="flex items-center gap-4 rounded-2xl bg-foreground px-7 py-5 font-mono text-background"
      style={{ ...useEnter(T, start), fontSize }}
    >
      <span className="opacity-50">$</span>
      <Typed caretHeight={fontSize * 1.15} t={T - start - 0.3} text={command} />
    </div>
  );
}

/** The real component, scaled up to `width` × `height` and driven from `T`. */
function Stage({
  T,
  height,
  name,
  width,
}: {
  T: number;
  height: number;
  name: string;
  width: number;
}) {
  const showcase = SHOWCASES[name];
  const shown = tw(T, 0.6, 1.45, 0, 1, MOTION.enter);
  const gone = goneAt(T);
  if (!showcase) {
    return (
      <div
        className="flex items-center justify-center font-mono text-2xl text-destructive"
        style={{ height, width }}
      >
        No showcase for “{name}” in src/showcases/index.ts
      </div>
    );
  }
  const { Demo } = showcase;
  const scale = Math.min(width / showcase.width, height / showcase.height, 2.2);
  // A slow push in while it plays.
  const push = 1 + 0.04 * ramp(T - 1.45, LEAVE_AT - 1.45);
  return (
    <div className="flex items-center justify-center" style={{ height, width }}>
      <div
        style={{
          height: showcase.height * scale,
          opacity: shown * (1 - gone),
          transform: `translateY(${lerp(24, 0, shown) - 32 * gone}px) scale(${lerp(0.96, 1, shown) * push})`,
          width: showcase.width * scale,
        }}
      >
        <div
          className={cn(
            "box-border origin-top-left rounded-[14px] border bg-card shadow-xs",
            name === "timeline" ? "overflow-hidden" : "p-4"
          )}
          style={{
            height: showcase.height,
            transform: `scale(${scale})`,
            width: showcase.width,
          }}
        >
          <Demo t={T - 1.15} />
        </div>
      </div>
    </div>
  );
}

/** The site, its logo and address, once the rest has left. */
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

/**
 * One component on screen: what it is, the real thing playing, and how to get
 * it. `kind` picks the story: a new component shows its install command, an
 * update lists what changed.
 */
export function Spotlight({
  description,
  kind,
  name,
  notes,
  theme,
  title,
  version,
}: SpotlightProps) {
  const T = useSeconds();
  // An update overwrites the files a project already has.
  const command =
    kind === "update"
      ? `npx shadcn@latest add @audio-ui/${name} -o`
      : `npx shadcn@latest add @audio-ui/${name}`;
  const header = useEnter(T, 0);
  const copy = useEnter(T, 0.8);
  const gone = goneAt(T);
  const showcase = SHOWCASES[name];
  // A wide component gets the whole width under the text; a compact one sits beside it.
  const wide = showcase
    ? showcase.width / showcase.height >= WIDE_RATIO
    : false;

  const heading = (
    <div
      style={{ opacity: 1 - gone, transform: `translateY(${-24 * gone}px)` }}
    >
      <Rise size={wide ? 150 : 168} t={T - 0.45} text={title} />
    </div>
  );
  const about = (
    <p
      className="max-w-[18em] text-pretty text-[34px] text-muted-foreground leading-snug"
      style={copy}
    >
      {description}
    </p>
  );
  const install =
    kind === "update" ? (
      <div className="flex flex-col gap-5">
        <Notes notes={notes} T={T} />
        <Install command={command} start={2.6 + notes.length * 0.2} T={T} />
      </div>
    ) : (
      <Install command={command} start={2.1} T={T} />
    );

  return (
    <div
      className={cn(
        "style-vega absolute inset-0 overflow-hidden bg-background font-sans text-foreground antialiased",
        theme === "dark" && "dark"
      )}
    >
      <div className="absolute top-18 left-24 flex items-center gap-5">
        <div style={header}>
          <Lockup size={36} />
        </div>
        <Status kind={kind} T={T} version={version} />
      </div>
      {wide ? (
        <div className="absolute inset-x-24 top-36 bottom-24 flex flex-col justify-center gap-14">
          {/* What it is on the left, how to get it on the right, the thing itself under both. */}
          <div className="flex items-end justify-between gap-20">
            <div className="flex flex-col gap-6">
              {heading}
              {about}
            </div>
            <div className="w-170 shrink-0">{install}</div>
          </div>
          <Stage height={440} name={name} T={T} width={1728} />
        </div>
      ) : (
        <div className="absolute inset-x-24 top-36 bottom-24 flex items-center gap-20">
          <div className="flex w-170 shrink-0 flex-col gap-12">
            <div className="flex flex-col gap-8">
              {heading}
              {about}
            </div>
            {install}
          </div>
          <Stage height={840} name={name} T={T} width={968} />
        </div>
      )}
      <Signoff T={T} />
    </div>
  );
}
