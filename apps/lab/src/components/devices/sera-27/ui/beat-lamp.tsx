import { useEffect, useRef } from "react";

/**
 * The tempo lamp: it lights on each beat while the rhythm runs. It reads the
 * transport's position each frame and sets its own attribute, so the beat
 * costs no render.
 */
export function BeatLamp({
  getPosition,
  playing,
  stepsPerBeat,
}: {
  getPosition: () => number;
  playing: boolean;
  stepsPerBeat: number;
}) {
  const lamp = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = lamp.current;
    if (!(node && playing)) {
      return;
    }
    let frame = 0;
    const tick = () => {
      node.toggleAttribute("data-on", getPosition() % stepsPerBeat < 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.removeAttribute("data-on");
    };
  }, [getPosition, playing, stepsPerBeat]);
  return <span aria-hidden="true" className="sera-led sera-beat" ref={lamp} />;
}
