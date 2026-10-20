import { Fader } from "@audio-ui/react/fader";
import { useCallback } from "react";
import { MAX_DRAWBAR } from "../audio/engine";
import type { OnDrawbar } from "./params";

const LEVELS = Array.from({ length: MAX_DRAWBAR }, (_, step) => step + 1);

/** How far a key moves a drawbar: a pull of one, or two with Page Up and Page Down. */
const KEY_STEPS: Record<string, number> = {
  ArrowDown: -1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageDown: -2,
  PageUp: 2,
};

/**
 * A drawbar: pulled toward the player to sound more, pushed in to sound less.
 * The fader's travel runs the other way, its top at the push-in, so the value
 * it works in is the pull taken from the full eight; the keys are turned round
 * to match, so an arrow up pulls the bar out as it would be read.
 */
export function Drawbar({
  cap,
  index,
  label,
  level,
  onDrawbar,
}: {
  cap: "black" | "brown" | "white";
  index: number;
  label: string;
  level: number;
  onDrawbar: OnDrawbar;
}) {
  const change = useCallback(
    (value: number) => onDrawbar(index, MAX_DRAWBAR - value),
    [index, onDrawbar]
  );
  const spoken = useCallback(
    (_formatted: string, value: number) => `${MAX_DRAWBAR - value}`,
    []
  );
  const keys = useCallback(
    (event: React.KeyboardEvent) => {
      let next: number | undefined;
      if (event.key in KEY_STEPS) {
        next = level + (KEY_STEPS[event.key] ?? 0);
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = MAX_DRAWBAR;
      }
      if (next === undefined) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onDrawbar(index, Math.min(MAX_DRAWBAR, Math.max(0, next)));
    },
    [index, level, onDrawbar]
  );
  return (
    <Fader.Root
      aria-label={`${label} drawbar`}
      className="capella-drawbar"
      data-cap={cap}
      max={MAX_DRAWBAR}
      min={0}
      onKeyDownCapture={keys}
      onValueChange={change}
      orientation="vertical"
      step={1}
      value={MAX_DRAWBAR - level}
    >
      <Fader.Control className="capella-drawbar-control">
        {LEVELS.map((step) => (
          <Fader.Mark
            className="capella-drawbar-mark"
            key={step}
            value={MAX_DRAWBAR - step}
          >
            <span className="capella-drawbar-numeral">{step}</span>
          </Fader.Mark>
        ))}
        <Fader.Track className="capella-drawbar-track" />
        <Fader.Thumb
          className="capella-drawbar-thumb"
          getAriaValueText={spoken}
        />
      </Fader.Control>
      <Fader.Label className="capella-label">{label}</Fader.Label>
    </Fader.Root>
  );
}
