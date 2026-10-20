import { useCallback } from "react";

/** One of the eight patch keys: its number, its lamp, and the name of the sound for a screen reader. */
export function PatchKey({
  index,
  name,
  onSelect,
  selected,
}: {
  index: number;
  name: string;
  onSelect: (index: number) => void;
  selected: boolean;
}) {
  const select = useCallback(() => onSelect(index), [index, onSelect]);
  return (
    <button
      aria-label={`Patch ${index + 1}, ${name}`}
      aria-pressed={selected}
      className="castor-patch"
      onClick={select}
      type="button"
    >
      <span
        aria-hidden="true"
        className="castor-lamp"
        data-on={selected || undefined}
      />
      {index + 1}
    </button>
  );
}
