import { mock } from "bun:test";
import { type RenderResult, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers";
import { Timeline } from "../../../entries/timeline";

/**
 * A 100-unit timeline whose ruler is 200px wide at the origin: 2px per unit
 * when fitted. Extra props go to the root.
 */
export function renderTimeline(props: Timeline.Root.Props = {}) {
  const onPositionChange = mock(
    (_value: number, _details: Timeline.Root.PositionChangeEventDetails) =>
      undefined
  );
  const onPositionCommitted = mock(
    (_value: number, _details: Timeline.Root.PositionCommitEventDetails) =>
      undefined
  );
  const view: RenderResult = render(
    <Timeline.Root
      data-testid="root"
      duration={100}
      onPositionChange={onPositionChange}
      onPositionCommitted={onPositionCommitted}
      {...props}
    >
      <Timeline.Ruler aria-label="Position" data-testid="ruler">
        <Timeline.Mark data-testid="mark" value={25}>
          2
        </Timeline.Mark>
      </Timeline.Ruler>
      <Timeline.Lane data-testid="lane">
        <Timeline.Playhead data-testid="playhead" />
      </Timeline.Lane>
    </Timeline.Root>
  );
  const ruler = view.getByTestId("ruler");
  mockRect(ruler, { bottom: 20, height: 20, right: 200, width: 200 });
  return {
    input: view.getByRole("slider") as HTMLInputElement,
    lane: view.getByTestId("lane"),
    onPositionChange,
    onPositionCommitted,
    playhead: view.getByTestId("playhead"),
    ruler,
    view,
  };
}

/** A hand-cranked position. */
export function createTestSource(initial: number) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    emit(next: number) {
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
    getSnapshot: () => value,
    listenerCount: () => listeners.size,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;
