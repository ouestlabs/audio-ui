import { mock } from "bun:test";
import { type RenderResult, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers.ts";
import { Piano } from "../../../entries/piano.ts";

/**
 * C3 (48) to C4 (60) on an 800×100 keyboard at the origin: eight white keys
 * 100px wide, five black ones. Extra props go to the root.
 */
export function renderPiano(props: Piano.Root.Props = {}) {
  const onNoteOn = mock(
    (_pitch: number, _details: Piano.Root.NoteOnEventDetails) => undefined
  );
  const onNoteOff = mock(
    (_pitch: number, _details: Piano.Root.NoteOffEventDetails) => undefined
  );
  const view: RenderResult = render(
    <Piano.Root
      aria-label="Piano"
      data-testid="root"
      maxPitch={60}
      minPitch={48}
      onNoteOff={onNoteOff}
      onNoteOn={onNoteOn}
      {...props}
    >
      <Piano.Keys>
        {(pitch) => (
          <Piano.Key data-testid={`key-${pitch}`} key={pitch} pitch={pitch}>
            <Piano.KeyLabel data-testid={`label-${pitch}`} />
          </Piano.Key>
        )}
      </Piano.Keys>
    </Piano.Root>
  );
  const root = view.getByTestId("root");
  mockRect(root, { bottom: 100, height: 100, right: 800, width: 800 });
  return {
    key: (pitch: number) => view.getByTestId(`key-${pitch}`),
    keys: view.getAllByRole("button"),
    onNoteOff,
    onNoteOn,
    root,
    view,
  };
}

export const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;
