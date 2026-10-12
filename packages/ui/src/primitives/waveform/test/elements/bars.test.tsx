import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { installFrames } from "../../../../../test/helpers.ts";
import { Waveform } from "../../../../entries/waveform.ts";
import { createTestSource } from "../helpers.tsx";

const levelOf = (bar: Element) =>
  Number((bar as HTMLElement).style.getPropertyValue("--waveform-level"));

let frames: ReturnType<typeof installFrames>;
beforeEach(() => {
  frames = installFrames();
});
afterEach(() => {
  frames.restore();
});

describe("Waveform.Bars", () => {
  test("renders one bar per count, each knowing its place", () => {
    const view = render(
      <Waveform.Root>
        <Waveform.Bars count={5} data-testid="bars" />
      </Waveform.Root>
    );
    const bars = [...view.getByTestId("bars").children];
    expect(bars).toHaveLength(5);
    expect(bars.map((bar) => bar.tagName)).toEqual(new Array(5).fill("SPAN"));
    expect(bars.map((bar) => bar.getAttribute("data-index"))).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  test("rests every bar at the minimum level without a signal", () => {
    const view = render(
      <Waveform.Root>
        <Waveform.Bars count={3} data-testid="bars" minLevel={0.1} />
      </Waveform.Root>
    );
    expect([...view.getByTestId("bars").children].map(levelOf)).toEqual([
      0.1, 0.1, 0.1,
    ]);
  });

  test("fits peaks to the bar count, as soon as it mounts", () => {
    const view = render(
      <Waveform.Root peaks={[0.2, 0.9, 0.5, 0.5, 0.1, 0.7]}>
        <Waveform.Bars count={3} data-testid="bars" />
      </Waveform.Root>
    );
    expect([...view.getByTestId("bars").children].map(levelOf)).toEqual([
      0.9, 0.5, 0.7,
    ]);
  });

  test("its children render each bar", () => {
    const view = render(
      <Waveform.Root>
        <Waveform.Bars count={2}>
          {(index, count) => (
            <Waveform.Bar
              className="bar"
              data-testid={`bar-${index}-of-${count}`}
              index={index}
              key={index}
            />
          )}
        </Waveform.Bars>
      </Waveform.Root>
    );
    expect(view.getByTestId("bar-1-of-2").className).toBe("bar");
  });

  test("follows a live signal in the DOM, without re-rendering React", () => {
    const levels = createTestSource([0, 0]);
    let renders = 0;
    function Parts() {
      renders += 1;
      return <Waveform.Bars count={2} data-testid="bars" minLevel={0} />;
    }
    const view = render(
      <Waveform.Root levels={levels}>
        <Parts />
      </Waveform.Root>
    );
    const bars = [...view.getByTestId("bars").children];
    const rendersAfterMount = renders;

    levels.emit([0.6, 0.3]);
    expect(bars.map(levelOf)).toEqual([0, 0]);
    frames.fire(1000);

    expect(bars.map(levelOf)).toEqual([0.6, 0.3]);
    expect(renders).toBe(rendersAfterMount);
  });

  test("levels rise at once and fall smoothly, then the bars rest", () => {
    const levels = createTestSource([1]);
    const view = render(
      <Waveform.Root levels={levels}>
        <Waveform.Bars count={1} data-testid="bars" minLevel={0} />
      </Waveform.Root>
    );
    const bar = view.getByTestId("bars").children[0] as Element;
    expect(levelOf(bar)).toBe(1);

    // The fall has a time constant of 110ms: about 37% of it is left by then.
    // The frame that wakes the bars up counts no time.
    levels.emit([0]);
    frames.fire(10);
    frames.fire(65);
    frames.fire(120);
    expect(levelOf(bar)).toBeCloseTo(Math.exp(-1), 2);

    for (let ms = 200; ms <= 2000; ms += 100) {
      frames.fire(ms);
    }
    expect(levelOf(bar)).toBeCloseTo(0, 2);
    expect(frames.pendingCount()).toBe(0);
  });

  test("mirrored puts the first level in the middle", () => {
    const view = render(
      <Waveform.Root peaks={[0.9, 0.5, 0.1]}>
        <Waveform.Bars count={5} data-testid="bars" minLevel={0} mirrored />
      </Waveform.Root>
    );
    expect([...view.getByTestId("bars").children].map(levelOf)).toEqual([
      0.1, 0.5, 0.9, 0.5, 0.1,
    ]);
  });

  test("gain scales what the bars show", () => {
    const view = render(
      <Waveform.Root peaks={[0.4]}>
        <Waveform.Bars count={1} data-testid="bars" gain={2} minLevel={0} />
      </Waveform.Root>
    );
    expect(levelOf(view.getByTestId("bars").children[0] as Element)).toBe(0.8);
  });

  test("keeps moving while loading, and rests once loaded", () => {
    const { rerender, getByTestId } = render(
      <Waveform.Root loading>
        <Waveform.Bars count={8} data-testid="bars" minLevel={0} />
      </Waveform.Root>
    );
    expect(frames.pendingCount()).toBe(1);
    frames.fire(100);
    frames.fire(200);
    const swept = [...getByTestId("bars").children].map(levelOf);
    expect(Math.max(...swept)).toBeGreaterThan(0.2);
    expect(frames.pendingCount()).toBe(1);

    rerender(
      <Waveform.Root>
        <Waveform.Bars count={8} data-testid="bars" minLevel={0} />
      </Waveform.Root>
    );
    expect(Math.max(...[...getByTestId("bars").children].map(levelOf))).toBe(0);
    expect(frames.pendingCount()).toBe(0);
  });

  test("marks the bars the playback position has passed", () => {
    const view = render(
      <Waveform.Root duration={100} value={50}>
        <Waveform.Bars count={4} data-testid="bars" />
      </Waveform.Root>
    );
    const played = () =>
      [...view.getByTestId("bars").children].map((bar) =>
        bar.hasAttribute("data-played")
      );
    expect(played()).toEqual([true, true, false, false]);

    view.rerender(
      <Waveform.Root duration={100} value={90}>
        <Waveform.Bars count={4} data-testid="bars" />
      </Waveform.Root>
    );
    expect(played()).toEqual([true, true, true, true]);
  });

  test("a bar must be used within Waveform.Bars", () => {
    expect(() =>
      render(
        <Waveform.Root>
          <Waveform.Bar index={0} />
        </Waveform.Root>
      )
    ).toThrow("Waveform.Bar must be used within Waveform.Bars");
  });
});
