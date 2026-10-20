import { useCallback } from "react";

/** One of the preset keys: the name of the registration printed on it, a lamp over it. */
export function PresetKey({
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
      aria-pressed={selected}
      className="capella-preset"
      onClick={select}
      type="button"
    >
      <span
        aria-hidden="true"
        className="capella-lamp"
        data-on={selected || undefined}
      />
      {name}
    </button>
  );
}
