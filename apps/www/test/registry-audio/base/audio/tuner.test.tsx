import { describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/react";
import { act, render, within } from "@testing-library/react";
import { Tuner } from "@/registry-audio/bases/base/audio/elements/tuner";
import type { PitchReading } from "@/registry-audio/bases/base/hooks/use-pitch";

const reading = (cents: number): PitchReading => ({
  cents,
  confidence: 0.98,
  frequency: 440 * 2 ** (cents / 1200),
  name: "A",
  octave: 4,
  pitch: 69,
});

function setup(initial: PitchReading | null = null, tolerance?: number) {
  const source = createSource<PitchReading | null>(initial);
  const view = render(<Tuner source={source} tolerance={tolerance} />);
  const root = within(view.container).getByRole("meter");
  return { root, source, view };
}

describe("Tuner", () => {
  test("is idle and says there is no sound before anything is played", () => {
    const { root } = setup();
    expect(root.hasAttribute("data-idle")).toBe(true);
    expect(root.getAttribute("aria-valuetext")).toBe("No sound");
    expect(root.textContent).toContain("– Hz");
  });

  test("reads the note, its octave, the frequency and the cents", () => {
    const { root } = setup(reading(12));
    expect(root.getAttribute("aria-valuetext")).toBe("A 4, 12 cents sharp");
    expect(root.getAttribute("aria-valuenow")).toBe("12");
    expect(root.textContent).toContain("A");
    expect(root.textContent).toContain("+12¢");
    expect(root.hasAttribute("data-in-tune")).toBe(false);
    expect(root.textContent).not.toContain("✓");
  });

  test("says flat for a negative offset", () => {
    const { root } = setup(reading(-30));
    expect(root.getAttribute("aria-valuetext")).toBe("A 4, 30 cents flat");
  });

  test("is in tune within the tolerance, and says so without color: a check and a data attribute", () => {
    const { root } = setup(reading(3));
    expect(root.hasAttribute("data-in-tune")).toBe(true);
    expect(root.getAttribute("aria-valuetext")).toBe("A 4, in tune");
    expect(root.textContent).toContain("✓ +3¢");
  });

  test("takes its tolerance as a prop", () => {
    expect(setup(reading(8), 10).root.hasAttribute("data-in-tune")).toBe(true);
    expect(setup(reading(8), 5).root.hasAttribute("data-in-tune")).toBe(false);
  });

  test("follows its source without rendering again", () => {
    const { root, source } = setup(reading(20));
    expect(root.hasAttribute("data-in-tune")).toBe(false);
    act(() => source.set(reading(0)));
    expect(root.hasAttribute("data-in-tune")).toBe(true);
    expect(root.textContent).toContain("✓ 0¢");
    act(() => source.set(null));
    expect(root.hasAttribute("data-idle")).toBe(true);
    expect(root.hasAttribute("data-in-tune")).toBe(false);
    expect(root.textContent).not.toContain("✓");
  });

  test("names a sharp note with the sharp sign and spells it out for a screen reader", () => {
    const sharp: PitchReading = {
      ...reading(0),
      name: "C#",
      octave: 5,
      pitch: 73,
    };
    const { root } = setup(sharp);
    expect(root.textContent).toContain("C♯");
    expect(root.getAttribute("aria-valuetext")).toBe("C sharp 5, in tune");
  });
});
