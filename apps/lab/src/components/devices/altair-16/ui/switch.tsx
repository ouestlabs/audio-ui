import { useCallback } from "react";

/** A two-way key with its lamp: pressed means the second word. */
export function Switch({
  off,
  on,
  onToggle,
  pressed,
}: {
  off: string;
  on: string;
  onToggle: (pressed: boolean) => void;
  pressed: boolean;
}) {
  const toggle = useCallback(() => onToggle(!pressed), [onToggle, pressed]);
  const word = pressed ? on : off;
  return (
    <button
      aria-pressed={pressed}
      className="altair-switch"
      onClick={toggle}
      type="button"
    >
      <span
        aria-hidden="true"
        className="altair-lamp"
        data-on={pressed || undefined}
      />
      {word}
    </button>
  );
}
