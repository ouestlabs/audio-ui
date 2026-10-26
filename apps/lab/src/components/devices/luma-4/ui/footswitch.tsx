/** The footswitch: a chrome stomp button under a red jewel that is lit while the effect is on. */
export function Footswitch({
  engaged,
  onToggle,
}: {
  engaged: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-pressed={engaged}
      className="luma-footswitch"
      onClick={onToggle}
      type="button"
    >
      <span
        aria-hidden="true"
        className="luma-jewel"
        data-on={engaged || undefined}
      />
      <span aria-hidden="true" className="luma-stomp" />
      Effect
    </button>
  );
}
