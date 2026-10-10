import { describe, expect, test } from "bun:test";
import { barCount, barRect, resamplePeaks } from "./waveform-bars";

describe("barCount", () => {
  test("fits bars and gaps into the width, without a trailing gap", () => {
    // 3px bars, 2px gaps: 20 bars need 20×3 + 19×2 = 98px
    expect(barCount(98, 3, 2)).toBe(20);
    expect(barCount(97, 3, 2)).toBe(19);
  });

  test("always draws at least one bar, and none without a width", () => {
    expect(barCount(1, 3, 2)).toBe(1);
    expect(barCount(0, 3, 2)).toBe(0);
  });
});

describe("resamplePeaks", () => {
  test("keeps the loudest peak of each bar's slice, so transients survive", () => {
    const peaks = [0.1, 0.9, 0.2, 0.2, 0.5, 0.4];
    expect(Array.from(resamplePeaks(peaks, 3))).toEqual([
      Math.fround(0.9),
      Math.fround(0.2),
      Math.fround(0.5),
    ]);
  });

  test("repeats the nearest peak when there are fewer peaks than bars", () => {
    expect(Array.from(resamplePeaks([0.25, 0.75], 4))).toEqual([
      0.25, 0.25, 0.75, 0.75,
    ]);
  });

  test("reads negative samples as magnitudes and caps levels at 1", () => {
    expect(Array.from(resamplePeaks([-0.5, 3], 2))).toEqual([0.5, 1]);
  });

  test("returns silence for empty data", () => {
    expect(Array.from(resamplePeaks([], 3))).toEqual([0, 0, 0]);
  });
});

describe("barRect", () => {
  const layout = { barGap: 2, barWidth: 3, height: 100 };

  test("mirror centers the bar; bars stands it on the baseline", () => {
    const mirrored = barRect(0.5, 2, { ...layout, variant: "mirror" });
    expect(mirrored).toMatchObject({ height: 50, width: 3, x: 10, y: 25 });
    const standing = barRect(0.5, 2, { ...layout, variant: "bars" });
    expect(standing).toMatchObject({ height: 50, x: 10, y: 50 });
  });

  test("silence still draws a sliver, faintly", () => {
    const rect = barRect(0, 0, { ...layout, variant: "mirror" });
    expect(rect.height).toBe(2);
    expect(rect.alpha).toBe(0.3);
  });

  test("a full-scale bar is fully opaque and fills the height", () => {
    const rect = barRect(1, 0, { ...layout, variant: "mirror" });
    expect(rect.height).toBe(100);
    expect(rect.alpha).toBe(1);
  });
});
