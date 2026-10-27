import { useCallback } from "react";

function Choice({
  active,
  onSelect,
  option,
}: {
  active: boolean;
  onSelect: (option: string) => void;
  option: string;
}) {
  const select = useCallback(() => onSelect(option), [onSelect, option]);
  return (
    <button
      aria-pressed={active}
      className="maia-key"
      onClick={select}
      type="button"
    >
      <span
        aria-hidden="true"
        className="maia-lamp"
        data-on={active || undefined}
      />
      {option}
    </button>
  );
}

/** A choice among a few stops: square keys with aria-pressed, a lamp lit on the one chosen. */
export function Selector({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly string[];
  value: string;
}) {
  return (
    <div aria-label={label} className="maia-selector" role="group">
      {options.map((option) => (
        <Choice
          active={value === option}
          key={option}
          onSelect={onChange}
          option={option}
        />
      ))}
    </div>
  );
}
