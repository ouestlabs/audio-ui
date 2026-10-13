import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Badge } from "@/registry/bases/base/ui/badge";
import { glyphEntrance, Lockup, LockupUrl } from "../brand.tsx";
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
};

const LEAVE_AT = SPOTLIGHT_SECONDS - 2.4;
/** How far everything has left: out faster than in, starting at once. */
const goneAt = (T: number) => MOTION.enter(ramp(T - LEAVE_AT, 0.35));

/** The room the frame is scaled into, in px. */
const AREA = { height: 888, width: 1728 };
/** How far the frame may be scaled: past it the site's hairlines turn heavy. */
const MAX_SCALE = 2.4;
/** The frame's own px, as on the site: the panel's breathing room round the component, its bars, its edges. */
const PANEL_PADDING = 40;
const HEADER_HEIGHT = 56;
const MIN_FRAME_WIDTH = 760;
/** The frame's `p-0.5` and border, then the panel's border, on both sides. */
const FRAME_EDGES = 6;
const PANEL_EDGES = 2;

/**
 * The component in the site's own frame, as the docs show it: a tinted frame,
 * one bar on top (audio/ui and its name, its description, its status badge at
 * the end) and the component alone in the panel. For an update, what changed
 * gets a panel of its own under the component, as the docs put the code under
 * a preview. The whole frame is scaled as one, so it keeps the site's
 * proportions, and nothing in it moves but the component and the notes.
 */
function Framed({
  T,
  description,
  kind,
  name,
  notes,
  title,
}: {
  T: number;
  description: string;
  kind: SpotlightProps["kind"];
  name: string;
  notes: string[];
  title: string;
}) {
  const showcase = SHOWCASES[name];
  const shown = tw(T, 0.45, 1.05, 0, 1, MOTION.enter);
  const gone = goneAt(T);
  // The bar grows with a long description and the notes take a panel: the frame is scaled from its measured height.
  const frame = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  useLayoutEffect(() => {
    setMeasured(frame.current?.offsetHeight ?? 0);
  });
  if (!showcase) {
    return (
      <div className="font-mono text-2xl text-destructive">
        No showcase for “{name}” in src/showcases/index.ts
      </div>
    );
  }
  const { Demo } = showcase;
  const width =
    Math.max(showcase.width + 2 * PANEL_PADDING, MIN_FRAME_WIDTH) +
    PANEL_EDGES +
    FRAME_EDGES;
  const height =
    measured ||
    HEADER_HEIGHT +
      showcase.height +
      2 * PANEL_PADDING +
      PANEL_EDGES +
      FRAME_EDGES;
  const scale = Math.min(AREA.width / width, AREA.height / height, MAX_SCALE);
  return (
    <div
      style={{
        height: height * scale,
        opacity: shown * (1 - gone),
        transform: `translateY(${lerp(24, 0, shown) - 32 * gone}px)`,
        width: width * scale,
      }}
    >
      <div
        className="flex origin-top-left flex-col overflow-hidden rounded-(--frame-radius) border border-site-border/80 bg-site-muted/50 p-0.5 font-site-sans"
        ref={frame}
        style={{ transform: `scale(${scale})`, width }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-6 px-3 py-2"
          style={{ minHeight: HEADER_HEIGHT }}
        >
          {/* What it is: the name, then the description under it, kept clear of the status. */}
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2.5 text-site-foreground text-sm">
              <Lockup size={14} />
              <span aria-hidden="true" className="text-site-muted-foreground">
                ·
              </span>
              <span className="font-medium">{title}</span>
            </div>
            <span className="line-clamp-2 text-pretty text-site-muted-foreground text-xs">
              {description}
            </span>
          </div>
          {/* Its status, at the end of the bar where the site puts its actions, centred on the name's line: a plain showcase has none. */}
          {kind === "showcase" ? null : (
            <div className="flex h-5 shrink-0 items-center self-start">
              <Badge className="gap-1.5 bg-site-background" variant="outline">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 rounded-full",
                    kind === "new" ? "bg-success" : "bg-info"
                  )}
                />
                {kind === "new" ? "New component" : "Updated"}
              </Badge>
            </div>
          )}
        </div>
        <div
          className="flex items-center justify-center rounded-(--frame-radius-inner) border border-site-border bg-site-background"
          style={{ padding: PANEL_PADDING }}
        >
          <div
            className={cn("box-border", name === "timeline" ? null : "p-4")}
            style={{ height: showcase.height, width: showcase.width }}
          >
            <Demo t={T - 0.45} />
          </div>
        </div>
        {kind === "update" ? (
          <ul className="mt-0.5 divide-y divide-site-border rounded-(--frame-radius-inner) border border-site-border bg-site-background text-site-foreground text-xs">
            {notes.map((note, index) => (
              <li
                className="flex items-baseline gap-2 px-4 py-2.5"
                key={note}
                style={{
                  opacity: tw(
                    T,
                    1 + index * 0.2,
                    1.4 + index * 0.2,
                    0,
                    1,
                    MOTION.enter
                  ),
                }}
              >
                <span aria-hidden="true" className="font-mono text-success">
                  +
                </span>
                {note}
              </li>
            ))}
          </ul>
        ) : null}
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
 * One component on screen, framed as in the docs and taking the screen: its
 * name, description and status in the frame's bar, the logo kept for the end.
 */
export function Spotlight({
  description,
  kind,
  name,
  notes,
  theme,
  title,
}: SpotlightProps) {
  const T = useSeconds();
  return (
    <div
      className={cn(
        "style-vega absolute inset-0 overflow-hidden bg-background font-sans text-foreground antialiased",
        theme === "dark" && "dark"
      )}
    >
      <div className="absolute inset-x-24 inset-y-24 flex items-center justify-center">
        <Framed
          description={description}
          kind={kind}
          name={name}
          notes={notes}
          T={T}
          title={title}
        />
      </div>
      <Signoff T={T} />
    </div>
  );
}
