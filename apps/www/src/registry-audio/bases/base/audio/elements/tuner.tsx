"use client";

import type { Source } from "@audio-ui/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { Input } from "@/registry/bases/base/ui/input";
import { useMicrophone } from "@/registry-audio/bases/base/hooks/use-microphone";
import {
  type PitchReading,
  usePitch,
} from "@/registry-audio/bases/base/hooks/use-pitch";

/** Cents from the note to either end of the gauge: half a semitone, where the next note begins. */
const RANGE_CENTS = 50;
const MARKS = [-50, -25, 0, 25, 50];

interface TunerDisplayProps {
  className?: string;
  /** The live reading, such as `usePitch` returns: `null` while nothing clear is playing. */
  source: Source<PitchReading | null>;
  /** How far from the note still counts as in tune, in cents. @default 5 */
  tolerance?: number;
}

const spoken = (reading: PitchReading, tolerance: number) => {
  const note = `${reading.name.replace("#", " sharp")} ${reading.octave}`;
  const cents = Math.round(reading.cents);
  if (Math.abs(reading.cents) <= tolerance) {
    return `${note}, in tune`;
  }
  return `${note}, ${Math.abs(cents)} cents ${cents > 0 ? "sharp" : "flat"}`;
};

/**
 * The display of a chromatic tuner: the nearest note, a needle on a scale from 50
 * cents flat to 50 sharp, and the frequency. It follows a live `source`
 * frame by frame, written straight into the DOM with no React render, and
 * turns to the primary color, thickens its needle and shows a check when the
 * sound is within `tolerance`: it is never color alone. Exposed as
 * a meter of cents, with the note and how far off it is as its text value.
 */
function TunerDisplay({ className, source, tolerance = 5 }: TunerDisplayProps) {
  const root = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  const octave = useRef<HTMLSpanElement>(null);
  const hertz = useRef<HTMLSpanElement>(null);
  const cents = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = root.current;
    const nodes = [note, octave, hertz, cents].map((ref) =>
      ref.current?.appendChild(document.createTextNode(""))
    );
    const [noteNode, octaveNode, hertzNode, centsNode] = nodes;
    if (!(element && noteNode && octaveNode && hertzNode && centsNode)) {
      return;
    }
    let shown: PitchReading | null | undefined;
    const paint = () => {
      const reading = source.getSnapshot();
      if (reading === shown) {
        return;
      }
      shown = reading;
      if (!reading) {
        noteNode.data = "–";
        octaveNode.data = "";
        hertzNode.data = "– Hz";
        centsNode.data = "";
        element.style.setProperty("--tuner-cents", "0");
        element.removeAttribute("data-in-tune");
        element.setAttribute("data-idle", "");
        element.setAttribute("aria-valuenow", "0");
        element.setAttribute("aria-valuetext", "No sound");
        return;
      }
      const offset = Math.round(reading.cents);
      noteNode.data = reading.name.replace("#", "♯");
      octaveNode.data = String(reading.octave);
      hertzNode.data = `${reading.frequency.toFixed(1)} Hz`;
      const inTune = Math.abs(reading.cents) <= tolerance;
      // In tune is never carried by color alone: the needle thickens and a check precedes the offset.
      centsNode.data = `${inTune ? "✓ " : ""}${offset > 0 ? "+" : ""}${offset}¢`;
      element.style.setProperty("--tuner-cents", String(reading.cents));
      element.removeAttribute("data-idle");
      if (inTune) {
        element.setAttribute("data-in-tune", "");
      } else {
        element.removeAttribute("data-in-tune");
      }
      element.setAttribute("aria-valuenow", String(offset));
      element.setAttribute("aria-valuetext", spoken(reading, tolerance));
    };
    paint();
    const unsubscribe = source.subscribe(paint);
    return () => {
      unsubscribe();
      for (const node of nodes) {
        node?.remove();
      }
    };
  }, [source, tolerance]);

  return (
    <div
      aria-label="Tuner"
      aria-valuemax={RANGE_CENTS}
      aria-valuemin={-RANGE_CENTS}
      aria-valuenow={0}
      aria-valuetext="No sound"
      className={cn(
        "group/tuner flex w-full flex-col items-center gap-4 text-center",
        className
      )}
      data-idle=""
      data-slot="tuner"
      ref={root}
      role="meter"
    >
      <div
        aria-hidden="true"
        className="flex items-baseline justify-center font-semibold text-5xl leading-none tabular-nums transition-colors group-data-idle/tuner:text-muted-foreground group-data-in-tune/tuner:text-primary"
      >
        <span ref={note} />
        <span className="text-2xl" ref={octave} />
      </div>
      <div
        aria-hidden="true"
        className="flex w-full max-w-72 items-end gap-2 text-muted-foreground text-sm"
      >
        <span>♭</span>
        <div className="relative h-10 flex-1">
          {MARKS.map((mark) => (
            <span
              className={cn(
                "absolute bottom-0 w-px -translate-x-1/2",
                mark === 0 ? "h-6 bg-foreground" : "h-3 bg-muted-foreground/60"
              )}
              key={mark}
              style={{ left: `${50 + mark}%` }}
            />
          ))}
          <span
            className="absolute bottom-0 h-8 w-0.5 -translate-x-1/2 rounded-full bg-foreground transition-[left,background-color] duration-100 ease-out group-data-idle/tuner:bg-muted-foreground/40 group-data-in-tune/tuner:w-1.5 group-data-in-tune/tuner:bg-primary motion-reduce:transition-none"
            style={{ left: "calc(50% + var(--tuner-cents, 0) * 1%)" }}
          />
        </div>
        <span>♯</span>
      </div>
      <div
        aria-hidden="true"
        className="flex gap-3 text-muted-foreground text-xs tabular-nums"
      >
        <span ref={hertz} />
        <span ref={cents} />
      </div>
    </div>
  );
}

const MIN_REFERENCE = 400;
const MAX_REFERENCE = 480;

interface TunerProps {
  className?: string;
  /** The frequency of A4 in hertz the field starts at: 432 or 442, say. @default 440 */
  reference?: number;
  /** How far from the note still counts as in tune, in cents. @default 5 */
  tolerance?: number;
}

/**
 * A chromatic tuner on its own: the display of the nearest note and how many
 * cents off it is, a button to start the microphone and a field for the pitch
 * of A4. Everything runs in the tab, nothing is recorded or sent. The pieces
 * are `useMicrophone`, `usePitch` and `TunerDisplay`, for a tuner of another
 * shape.
 */
function Tuner({ className, reference = 440, tolerance = 5 }: TunerProps) {
  const microphone = useMicrophone();
  const [a4, setA4] = useState(reference);
  const pitch = usePitch(microphone.analyser, { reference: a4 });
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-72 flex-col items-center gap-4",
        className
      )}
      data-slot="tuner-tool"
    >
      <TunerDisplay source={pitch} tolerance={tolerance} />
      <div className="flex items-center gap-3">
        <Button
          onClick={microphone.isListening ? microphone.stop : microphone.start}
          size="sm"
          type="button"
          variant={microphone.isListening ? "outline" : "default"}
        >
          {microphone.isListening ? "Stop" : "Start"}
        </Button>
        <label
          className="flex items-center gap-1.5 text-muted-foreground text-sm"
          htmlFor="tuner-reference"
        >
          A4
          <Input
            className="h-7 w-16 text-center tabular-nums"
            id="tuner-reference"
            max={MAX_REFERENCE}
            min={MIN_REFERENCE}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (next >= MIN_REFERENCE && next <= MAX_REFERENCE) {
                setA4(next);
              }
            }}
            step={1}
            type="number"
            value={a4}
          />
          Hz
        </label>
      </div>
      {microphone.error ? (
        <p aria-live="polite" className="text-destructive text-sm">
          {microphone.error}
        </p>
      ) : null}
    </div>
  );
}

export { Tuner, TunerDisplay };
