/**
 * A clock that counts steps at a tempo, for a pattern played in a preview. It
 * ticks with a timer rather than on the audio clock, so it is not sample
 * accurate: for a transport that keeps time under load, use
 * `use-transport-clock` over `@/engine/time`.
 */
export function createStepPlayer({
  bpm = 120,
  onStep,
  steps,
  stepsPerBeat = 4,
}: {
  bpm?: number;
  /** Called on every step, with its index: play what the pattern holds there. */
  onStep: (step: number) => void;
  steps: number;
  stepsPerBeat?: number;
}) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let next = 0;
  // The step being played, `-1` while stopped: a live source for `Sequencer`.
  let current = -1;
  const listeners = new Set<() => void>();
  const set = (step: number) => {
    current = step;
    for (const listener of listeners) {
      listener();
    }
  };
  const tick = () => {
    const step = next;
    next = (next + 1) % steps;
    onStep(step);
    set(step);
  };

  return {
    isPlaying: () => timer !== undefined,
    source: {
      getSnapshot: () => current,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    start() {
      if (timer === undefined) {
        next = 0;
        tick();
        timer = setInterval(tick, 60_000 / bpm / stepsPerBeat);
      }
    },
    stop() {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
      set(-1);
    },
  };
}
