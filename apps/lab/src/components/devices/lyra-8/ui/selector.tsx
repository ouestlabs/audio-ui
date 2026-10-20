import { useCallback } from "react";

function Rocker({
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
      className="lyra-rocker"
      onClick={select}
      type="button"
    >
      <span
        aria-hidden="true"
        className="lyra-lamp"
        data-on={active || undefined}
      />
      {option}
    </button>
  );
}

/** A choice among a few stops: buttons with aria-pressed, each with the lamp that lights when chosen. */
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
    <div aria-label={label} className="lyra-selector" role="group">
      {options.map((option) => (
        <Rocker
          active={value === option}
          key={option}
          onSelect={onChange}
          option={option}
        />
      ))}
    </div>
  );
}
