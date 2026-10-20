import type { ReactNode } from "react";

/** A transport key with its lamp: it stays down while it is on. */
export function Key({
  children,
  disabled,
  lit,
  onPress,
  pressed,
}: {
  children: ReactNode;
  disabled?: boolean;
  lit?: boolean;
  onPress: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      aria-pressed={pressed}
      className="vesta-key"
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
      <span
        aria-hidden="true"
        className="vesta-lamp"
        data-on={lit || undefined}
      />
      {children}
    </button>
  );
}
