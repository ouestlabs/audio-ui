import { mock } from "bun:test";
import { type RenderResult, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers.ts";
import { Pad } from "../../../entries/pad.ts";

/** Kick, snare, clap and tom on the first row, then the hats sharing a choke group. */
export const PADS = [
  { value: "kick" },
  { value: "snare" },
  { value: "clap" },
  { value: "tom" },
  { chokeGroup: "hat", value: "closed" },
  { chokeGroup: "hat", value: "open" },
];

/**
 * Six pads, four to a row, each 100px tall at the origin. Extra props go to
 * the root; `disabledPads` disables single pads.
 */
export function renderPad({
  disabledPads = [],
  ...props
}: Pad.Root.Props & { disabledPads?: string[] } = {}) {
  const onPadOn = mock(
    (_value: string, _details: Pad.Root.OnEventDetails) => undefined
  );
  const onPadOff = mock(
    (_value: string, _details: Pad.Root.OffEventDetails) => undefined
  );
  const view: RenderResult = render(
    <Pad.Root
      aria-label="Drum pads"
      data-testid="root"
      onPadOff={onPadOff}
      onPadOn={onPadOn}
      {...props}
    >
      {PADS.map((item) => (
        <Pad.Item
          chokeGroup={item.chokeGroup}
          data-testid={item.value}
          disabled={disabledPads.includes(item.value)}
          key={item.value}
          value={item.value}
        >
          {item.value}
        </Pad.Item>
      ))}
    </Pad.Root>
  );
  const pad = (value: string) => view.getByTestId(value);
  for (const { value } of PADS) {
    mockRect(pad(value), { bottom: 100, height: 100, right: 100, width: 100 });
  }
  return {
    onPadOff,
    onPadOn,
    pad,
    pads: view.getAllByRole("button"),
    root: view.getByTestId("root"),
    view,
  };
}

export const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;
