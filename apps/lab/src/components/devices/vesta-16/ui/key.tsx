import type { ReactNode } from "react";

/** A transport key with its lamp: it stays down while it is on. */
export function Key({
  children,
  confirm,
  disabled,
  lit,
  onPress,
  pressed,
}: {
  children: ReactNode;
  confirm?: string;
  disabled?: boolean;
  lit?: boolean;
  onPress: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      aria-pressed={pressed}
      className="vesta-key"
      data-agent-confirm={confirm}
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
