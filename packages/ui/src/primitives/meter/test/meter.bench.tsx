import { describe, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import { act, render } from "@testing-library/react";
import { bench, sweep } from "../../../../test/bench";
import { Meter } from "../../../entries/meter";

const frame = (channels: number, index: number) => ({
  levels: Array.from(
    { length: channels },
    (_, channel) => -60 + sweep(index + channel * 7, 60)
  ),
  peaks: Array.from({ length: channels }, () => -3),
});

describe("Meter", () => {
  for (const channels of [2, 8, 32, 64]) {
    test(`${channels} channels painted from a live source`, () => {
      const source = createSource({ levels: new Array(channels).fill(-60) });
      render(
        <Meter.Root aria-label="Out" max={0} min={-60} source={source}>
          <Meter.Channels>
            {(index) => (
              <Meter.Channel
                aria-label={`Ch ${index}`}
                index={index}
                key={index}
              >
                <Meter.Indicator />
                <Meter.Peak />
                <Meter.Value />
              </Meter.Channel>
            )}
          </Meter.Channels>
        </Meter.Root>
      );
      bench(`${channels} channels, one emit`, (index) => {
        act(() => source.set(frame(channels, index)));
      });
    });
  }
});
