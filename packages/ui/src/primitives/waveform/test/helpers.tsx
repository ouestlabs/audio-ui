import { mock } from "bun:test";
import { type RenderResult, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers";
import { Waveform } from "../../../entries/waveform";

const PEAKS = [0.2, 0.8, 0.5, 1];

export const seconds = (value: number) => `${value}s`;

/** A 100-second track on a 200×40 control at the origin: 2px per second. */
export function renderWaveform(
  props: Waveform.Root.Props = {},
  onRender?: () => void
) {
  const onValueChange = mock(
    (_value: number, _details: Waveform.Root.ChangeEventDetails) => undefined
  );
  const onValueCommitted = mock(
    (_value: number, _details: Waveform.Root.CommitEventDetails) => undefined
  );
  function Parts() {
    onRender?.();
    return (
      <Waveform.Control aria-label="Seek" data-testid="control">
        <Waveform.Canvas data-testid="canvas" />
        <Waveform.Playhead data-testid="playhead" />
        <Waveform.Thumb data-testid="thumb" />
        <Waveform.Hover data-testid="hover">{seconds}</Waveform.Hover>
      </Waveform.Control>
    );
  }
  const view: RenderResult = render(
    <Waveform.Root
      data-testid="root"
      duration={100}
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      peaks={PEAKS}
      {...props}
    >
      <Parts />
    </Waveform.Root>
  );
  const control = view.getByTestId("control");
  mockRect(control, { bottom: 40, height: 40, right: 200, width: 200 });
  return {
    control,
    input: view.getByRole("slider") as HTMLInputElement,
    onValueChange,
    onValueCommitted,
    position: () =>
      view.getByTestId("root").style.getPropertyValue("--waveform-position"),
    view,
  };
}

/** A hand-cranked source: a playback position, or the levels of a live signal. */
export function createTestSource<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    emit(next: T) {
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
