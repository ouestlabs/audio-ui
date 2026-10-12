import { describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import { Waveform } from "../../../../entries/waveform.js";
import { createTestSource, renderWaveform } from "../helpers.js";

const clock = (value: number, duration: number) =>
  `${Math.round(value)} of ${Math.round(duration)} seconds`;

describe("Waveform.Root value", () => {
  test("starts at 0, with a named native range input spanning the duration", () => {
    const { input, position } = renderWaveform();
    expect(input.type).toBe("range");
    expect(input.value).toBe("0");
    expect(input.max).toBe("100");
    expect(input.getAttribute("aria-label")).toBe("Seek");
    expect(position()).toBe("0%");
  });

  test("exposes the position as a percentage CSS variable the playhead and thumb follow", () => {
    const { position, view } = renderWaveform({ value: 25 });
    expect(position()).toBe("25%");
    expect(view.getByTestId("playhead").style.left).toBe(
      "var(--waveform-position)"
    );
    expect(view.getByTestId("thumb").style.left).toBe(
      "var(--waveform-position)"
    );
  });

  test("clamps an out-of-range position", () => {
    expect(renderWaveform({ value: 400 }).position()).toBe("100%");
  });

  test("treats a NaN position as the start", () => {
    expect(renderWaveform({ value: Number.NaN }).position()).toBe("0%");
  });

  test("announces the played share by default", () => {
    expect(
      renderWaveform({ value: 30 }).input.getAttribute("aria-valuetext")
    ).toBe("30%");
  });

  test("getAriaValueText announces the position in real units", () => {
    const view = render(
      <Waveform.Root duration={100} value={12}>
        <Waveform.Control aria-label="Seek" getAriaValueText={clock} />
      </Waveform.Root>
    );
    expect(view.getByRole("slider").getAttribute("aria-valuetext")).toBe(
      "12 of 100 seconds"
    );
  });
});

describe("Waveform.Root with a live position", () => {
  test("follows the source in the DOM without re-rendering React", () => {
    const source = createTestSource(0);
    let renders = 0;
    const { input, position } = renderWaveform({ source }, () => {
      renders += 1;
    });
    const rendersAfterMount = renders;

    act(() => source.emit(42));

    expect(renders).toBe(rendersAfterMount);
    expect(position()).toBe("42%");
    expect(input.value).toBe("42");
    expect(input.getAttribute("aria-valuetext")).toBe("42%");
  });

  test("a scrub wins over the source until the pointer is released", () => {
    const source = createTestSource(10);
    const { control, position } = renderWaveform({ source });

    fireEvent.pointerDown(control, { clientX: 100, clientY: 20, pointerId: 1 });
    act(() => source.emit(11));
    expect(position()).toBe("50%");

    fireEvent.pointerUp(control, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(position()).toBe("11%");
  });

  test("unsubscribes on unmount", () => {
    const source = createTestSource(0);
    const { view } = renderWaveform({ source });
    expect(source.listenerCount()).toBe(1);
    view.unmount();
    expect(source.listenerCount()).toBe(0);
  });
});

describe("Waveform.Root with a live signal", () => {
  test("carries data-active while the signal is audible", () => {
    const levels = createTestSource([0, 0]);
    const view = render(<Waveform.Root data-testid="root" levels={levels} />);
    const root = view.getByTestId("root");
    expect(root.hasAttribute("data-active")).toBe(false);

    act(() => levels.emit([0.4, 0.1]));
    expect(root.hasAttribute("data-active")).toBe(true);

    act(() => levels.emit([0.01, 0]));
    expect(root.hasAttribute("data-active")).toBe(false);
  });

  test("stops listening on unmount", () => {
    const levels = createTestSource([0.5]);
    const view = render(
      <Waveform.Root levels={levels}>
        <Waveform.Bars />
      </Waveform.Root>
    );
    expect(levels.listenerCount()).toBe(2);
    view.unmount();
    expect(levels.listenerCount()).toBe(0);
  });
});
