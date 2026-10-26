import { useCallback } from "react";

/** A flat membrane button of a row: its number printed on it, a red LED over it that lights when it is the one chosen. */
export function Membrane({
  color,
  index,
  label,
  onSelect,
  selected,
}: {
  color: "maroon" | "teal";
  index: number;
  /** What a screen reader hears: `Voice 3, Bass`. */
  label: string;
  onSelect: (index: number) => void;
  selected: boolean;
}) {
  const select = useCallback(() => onSelect(index), [index, onSelect]);
  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className="nova-membrane"
      data-color={color}
      onClick={select}
      type="button"
    >
      <span
        aria-hidden="true"
        className="nova-led"
        data-on={selected || undefined}
      />
      <span aria-hidden="true" className="nova-membrane-face">
        {index + 1}
      </span>
    </button>
  );
}
