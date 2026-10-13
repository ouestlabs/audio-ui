import { cn } from "@/registry/bases/base/lib/utils";
import { glyphEntrance, Lockup, LockupUrl, Rise, Typed } from "../brand.tsx";
import { lerp, MOTION, ramp, tw, useSeconds } from "../motion.ts";
import { SHOWCASES } from "../showcases/index.ts";

export const SPOTLIGHT_SECONDS = 10;

export interface SpotlightProps {
  /** One line on what it is: the docs page's `description`. */
  description: string;
  /** A component the library didn't have, or changes to one it has. */
  kind: "new" | "update";
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

function Badge({
  T,
  kind,
  version,
}: {
  T: number;
  kind: SpotlightProps["kind"];
  version: string;
}) {
  const shown = MOTION.enter(ramp(T - 0.35, 0.5));
  const gone = goneAt(T);
  return (
    <div
      className="flex items-center gap-3 self-start rounded-full border bg-card py-2 pr-5 pl-3 font-medium text-2xl shadow-xs"
      style={{
        opacity: shown * (1 - gone),
        transform: `translateY(${-24 * gone}px) scale(${lerp(0.95, 1, shown)})`,
      }}
    >
      <span
        className={cn(
          "size-3 rounded-full",
          kind === "new" ? "bg-success" : "bg-info"
        )}
      />
      {kind === "new" ? "New component" : "Updated"}
      <span className="font-mono text-muted-foreground text-xl">
        v{version}
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

function Install({
  T,
  command,
  start,
}: {
  T: number;
  command: string;
  start: number;
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-2xl bg-foreground px-7 py-5 font-mono text-[26px] text-background"
      style={useEnter(T, start)}
    >
      <span className="opacity-50">$</span>
      <Typed caretHeight={30} t={T - start - 0.3} text={command} />
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
  const command =
    kind === "new"
      ? `npx shadcn@latest add @audio-ui/${name}`
      : `npx shadcn@latest add @audio-ui/${name} -o`;
  const header = useEnter(T, 0);
  const copy = useEnter(T, 0.8);
  const gone = goneAt(T);

  return (
    <div
      className={cn(
        "style-vega absolute inset-0 overflow-hidden bg-background font-sans text-foreground antialiased",
        theme === "dark" && "dark"
      )}
    >
      <div className="absolute top-18 left-24" style={header}>
        <Lockup size={36} />
      </div>
      <div className="absolute inset-x-24 top-36 bottom-24 flex items-center gap-20">
        <div className="flex w-170 shrink-0 flex-col gap-12">
          <div className="flex flex-col gap-8">
            <Badge kind={kind} T={T} version={version} />
            <div
              style={{
                opacity: 1 - gone,
                transform: `translateY(${-24 * gone}px)`,
              }}
            >
              <Rise size={168} t={T - 0.45} text={title} />
            </div>
            <p
              className="max-w-[18em] text-pretty text-[34px] text-muted-foreground leading-snug"
              style={copy}
            >
              {description}
            </p>
          </div>
          {kind === "update" ? (
            <div className="flex flex-col gap-5">
              <Notes notes={notes} T={T} />
              <Install
                command={command}
                start={2.6 + notes.length * 0.2}
                T={T}
              />
            </div>
          ) : (
            <Install command={command} start={2.1} T={T} />
          )}
        </div>
        <Stage height={840} name={name} T={T} width={968} />
      </div>
      <Signoff T={T} />
    </div>
  );
}
