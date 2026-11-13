import { describe, expect, test } from "bun:test";
import {
  hertzLabel,
  loadScales,
  panBand,
  readHertz,
  spectrogramAxis,
  zoomBand,
} from "./index.ts";

describe("zoomBand", () => {
  test("zooming in keeps the frequency under the pointer where it is", () => {
    const [from, to] = zoomBand([0, 1], 0.25, 0.5);
    expect(from + 0.25 * (to - from)).toBeCloseTo(0.25, 10);
    expect(to - from).toBeCloseTo(0.5, 10);
  });

  test("the band stays inside the axis, and is never narrower than a fiftieth of it", () => {
    expect(zoomBand([0, 1], 0.5, 2)).toEqual([0, 1]);
    const [from, to] = zoomBand([0.2, 0.4], 0.5, 0.0001);
    expect(to - from).toBeCloseTo(0.02, 10);
    const [low, high] = zoomBand([0.9, 1], 1, 0.5);
    expect(high).toBeLessThanOrEqual(1);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

describe("panBand", () => {
  test("moves by a share of its own width, and stops at the ends", () => {
    expect(panBand([0.2, 0.4], 0.5)[0]).toBeCloseTo(0.3, 10);
    expect(panBand([0.2, 0.4], 100)).toEqual([0.8, 1]);
    expect(panBand([0.2, 0.4], -100)).toEqual([0, 0.2]);
  });
});

describe("frequencies as the axis writes them", () => {
  test("no unit, a k from a thousand", () => {
    expect(hertzLabel(20_000)).toBe("20k");
    expect(hertzLabel(1250)).toBe("1.25k");
    expect(hertzLabel(500)).toBe("500");
    expect(hertzLabel(20)).toBe("20");
  });

  test("the pointer's reading has three significant digits", () => {
    expect(readHertz(12_345)).toBe("12.3k");
    expect(readHertz(523.4)).toBe("523");
    expect(readHertz(52.34)).toBe("52.3");
  });
});

describe("spectrogramAxis", () => {
  const height = 120;
  const nyquist = 24_000;

  test("all of the axis keeps the roundest labels, a decade apart, with ticks between", async () => {
    const scales = await loadScales();
    const layout = spectrogramAxis({
      axis: scales.log,
      height,
      nyquist,
      scale: "log",
    });
    expect(layout.labels.map((label) => label.text).slice(0, 3)).toEqual([
      "20k",
      "2k",
      "200",
    ]);
    expect(layout.minor.length).toBeGreaterThan(10);
    // Each tick sits on the row of its frequency; the foot is 0.
    const [first] = layout.labels;
    expect(first?.tick).toBeCloseTo(layout.at(20_000), 6);
  });

  test("no two labels are closer than the room a label takes", async () => {
    const scales = await loadScales();
    for (const scale of ["log", "mel", "erb", "lin"] as const) {
      const layout = spectrogramAxis({
        axis: scales[scale],
        height,
        nyquist,
        scale,
      });
      const rows = layout.labels.map((label) => label.y).sort((a, b) => a - b);
      for (let index = 1; index < rows.length; index += 1) {
        expect(
          (rows[index] as number) - (rows[index - 1] as number)
        ).toBeGreaterThanOrEqual(15);
      }
    }
  });

  test("zoomed in, it labels the round values in view, and none of the ticks between", async () => {
    const scales = await loadScales();
    const axis = scales.log;
    const at = (hertz: number) => axis.at(hertz, axis.low, nyquist);
    const layout = spectrogramAxis({
      axis,
      band: [at(100), at(400)],
      height,
      nyquist,
      scale: "log",
    });
    const texts = layout.labels.map((label) => label.text);
    expect(texts).toContain("200");
    expect(texts).not.toContain("20k");
    expect(layout.minor).toEqual([]);
  });

  test("the pointer is marked, and the labels near it give way", async () => {
    const scales = await loadScales();
    const plain = spectrogramAxis({
      axis: scales.log,
      height,
      nyquist,
      scale: "log",
    });
    const [, second] = plain.labels;
    const marked = spectrogramAxis({
      axis: scales.log,
      height,
      nyquist,
      pointer: second?.hertz,
      scale: "log",
    });
    expect(marked.marker).toBeCloseTo(second?.tick ?? 0, 6);
    expect(marked.labels.some((label) => label.hertz === second?.hertz)).toBe(
      false
    );
  });
});
