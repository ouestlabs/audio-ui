import type { Source } from "@audio-ui/core";
import { useEffect, useRef } from "react";
import { STEPS } from "../audio/engine";

const STEP_LIST = Array.from({ length: STEPS }, (_, step) => step);

/**
 * The loop of the chosen pad: sixteen lamps, lit where it has a hit, and the
 * step being played marked straight in the DOM, so the clock never renders React.
 */
export function Steps({
  hits,
  position,
}: {
  hits: readonly boolean[];
  position: Source<number>;
}) {
  const root = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const follow = () => {
      const at = Math.floor(position.getSnapshot());
      for (const [index, node] of [
        ...(root.current?.children ?? []),
      ].entries()) {
        node.toggleAttribute("data-current", index === at);
      }
    };
    follow();
    return position.subscribe(follow);
  }, [position]);

  return (
    <ol aria-label="Loop of the chosen pad" className="vesta-steps" ref={root}>
      {STEP_LIST.map((step) => (
        <li
          className="vesta-step"
          data-beat={step % 4 === 0 || undefined}
          data-on={hits[step] || undefined}
          key={step}
        >
          <span aria-hidden="true" className="vesta-lamp" />
        </li>
      ))}
    </ol>
  );
}
