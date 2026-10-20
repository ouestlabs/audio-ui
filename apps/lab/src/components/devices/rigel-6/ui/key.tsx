import { useCallback } from "react";
import type { Channel, Strip } from "../audio/engine";
import type { OnStrip } from "./params";

/** A mute or a solo key, with its lamp. */
export function Key({
  channel,
  field,
  label,
  onStrip,
  pressed,
}: {
  channel: Channel;
  field: Extract<keyof Strip, "mute" | "solo">;
  label: string;
  onStrip: OnStrip;
  pressed: boolean;
}) {
  const toggle = useCallback(
    () => onStrip(channel, field, !pressed),
    [channel, field, onStrip, pressed]
  );
  return (
    <button
      aria-label={`${label} ${channel}`}
      aria-pressed={pressed}
      className="rigel-key"
      data-kind={field}
      onClick={toggle}
      type="button"
    >
      <span
        aria-hidden="true"
        className="rigel-lamp"
        data-on={pressed || undefined}
      />
      {label.slice(0, 1)}
    </button>
  );
}
