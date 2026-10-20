import { useCallback } from "react";
import type { Instrument } from "../audio/engine";
import { NAMES } from "./params";

/** An instrument's key on the panel, with its lamp over it and its name printed under it. */
export function InstrumentKey({
  filled,
  instrument,
  onSelect,
  selected,
}: {
  /** Whether the instrument has any step in its pattern. */
  filled: boolean;
  instrument: Instrument;
  onSelect: (instrument: Instrument) => void;
  selected: boolean;
}) {
  const select = useCallback(
    () => onSelect(instrument),
    [instrument, onSelect]
  );
  return (
    <div className="vega-instrument">
      <span
        aria-hidden="true"
        className="vega-lamp"
        data-on={selected || undefined}
      />
      <button
        aria-label={NAMES[instrument].long}
        aria-pressed={selected}
        className="vega-key"
        data-filled={filled || undefined}
        onClick={select}
        type="button"
      />
      <span aria-hidden="true" className="vega-key-label">
        {NAMES[instrument].short}
      </span>
    </div>
  );
}
