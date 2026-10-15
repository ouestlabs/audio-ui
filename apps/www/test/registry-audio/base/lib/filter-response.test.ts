import { describe, expect, test } from "bun:test";
import {
  bandGainForHandle,
  bandHandleDb,
  biquadResponse,
  compressorOutput,
  eqResponse,
  formatDb,
  formatHz,
} from "@/registry-audio/bases/base/lib/filter-response";

describe("biquadResponse", () => {
  test("a peak boosts its centre by its gain and leaves the far ends alone", () => {
    const response = biquadResponse({
      frequency: 1000,
      gainDb: 6,
      q: 1,
      type: "peak",
    });
    expect(response(1000)).toBeCloseTo(6, 1);
    expect(Math.abs(response(20))).toBeLessThan(0.1);
    expect(Math.abs(response(20_000))).toBeLessThan(1);
  });

  test("a low cut is 3 dB down at its corner and removes what is below", () => {
    const response = biquadResponse({ frequency: 200, type: "lowcut" });
    expect(response(200)).toBeCloseTo(-3, 0);
    expect(response(20)).toBeLessThan(-30);
    expect(Math.abs(response(5000))).toBeLessThan(0.1);
  });

  test("a high cut mirrors it", () => {
    const response = biquadResponse({ frequency: 2000, type: "highcut" });
    expect(response(2000)).toBeCloseTo(-3, 0);
    expect(response(18_000)).toBeLessThan(-30);
    expect(Math.abs(response(50))).toBeLessThan(0.1);
  });

  test("a resonant low-pass peaks above unity at its cutoff", () => {
    const response = biquadResponse({ frequency: 1000, q: 8, type: "highcut" });
    expect(response(1000)).toBeGreaterThan(15);
  });

  test("shelves reach their gain on their own side", () => {
    const low = biquadResponse({ frequency: 200, gainDb: 6, type: "lowshelf" });
    expect(low(30)).toBeCloseTo(6, 0);
    expect(Math.abs(low(10_000))).toBeLessThan(0.1);
    const high = biquadResponse({
      frequency: 5000,
      gainDb: -6,
      type: "highshelf",
    });
    expect(high(18_000)).toBeCloseTo(-6, 0);
    expect(Math.abs(high(100))).toBeLessThan(0.1);
  });

  test("a notch nearly removes its frequency", () => {
    const response = biquadResponse({ frequency: 1000, q: 4, type: "notch" });
    expect(response(1000)).toBeLessThan(-40);
    expect(Math.abs(response(100))).toBeLessThan(0.5);
  });

  test("a band-pass passes its centre at unity", () => {
    const response = biquadResponse({
      frequency: 1000,
      q: 2,
      type: "bandpass",
    });
    expect(response(1000)).toBeCloseTo(0, 0);
    expect(response(60)).toBeLessThan(-20);
  });
});

describe("eqResponse", () => {
  test("adds the bands in dB, leaving out those switched off", () => {
    const bands = [
      { frequency: 1000, gainDb: 6, q: 1, type: "peak" as const },
      { frequency: 1000, gainDb: 6, q: 1, type: "peak" as const },
      { frequency: 1000, gainDb: 12, on: false, q: 1, type: "peak" as const },
    ];
    expect(eqResponse(bands)(1000)).toBeCloseTo(12, 1);
  });

  test("is flat with no bands", () => {
    expect(eqResponse([])(1000)).toBe(0);
  });
});

describe("band handles", () => {
  const bands = [
    { frequency: 100, gainDb: 6, type: "lowshelf" as const },
    { frequency: 1000, gainDb: -4, q: 1, type: "peak" as const },
  ];

  test("a peak's handle sits at its gain, plus what the others add there", () => {
    const alone = [{ frequency: 1000, gainDb: 6, q: 1, type: "peak" as const }];
    expect(bandHandleDb(alone, 0)).toBeCloseTo(6, 1);
    expect(bandHandleDb(bands, 1)).toBeCloseTo(-4, 0);
  });

  test("a shelf's handle sits halfway up its slope", () => {
    const alone = [{ frequency: 100, gainDb: 8, type: "lowshelf" as const }];
    expect(bandHandleDb(alone, 0)).toBeCloseTo(4, 0);
  });

  test("dragging inverts it: the gain that puts the handle where the pointer is", () => {
    for (const index of [0, 1]) {
      const band = bands[index];
      const target = 5;
      const gain = bandGainForHandle(
        bands,
        index,
        band?.frequency ?? 0,
        target
      );
      const next = bands.map((other, at) =>
        at === index ? { ...other, gainDb: gain } : other
      );
      expect(bandHandleDb(next, index)).toBeCloseTo(target, 1);
    }
  });

  test("keeps the gain of a band that takes none", () => {
    const cut = [{ frequency: 100, gainDb: 0, type: "lowcut" as const }];
    expect(bandGainForHandle(cut, 0, 100, 5)).toBe(0);
  });
});

describe("compressorOutput", () => {
  const settings = { ratio: 4, thresholdDb: -20 };

  test("passes the level below the threshold", () => {
    expect(compressorOutput(settings)(-40)).toBe(-40);
  });

  test("lets one dB in four over the threshold through", () => {
    // 8 dB over becomes 2 dB over.
    expect(compressorOutput(settings)(-12)).toBeCloseTo(-18);
  });

  test("adds makeup gain to everything", () => {
    expect(compressorOutput({ ...settings, makeupDb: 3 })(-40)).toBe(-37);
  });

  test("bends smoothly across the knee, meeting the straight lines at its edges", () => {
    const soft = compressorOutput({ ...settings, kneeDb: 10 });
    expect(soft(-25)).toBeCloseTo(-25, 5);
    expect(soft(-15)).toBeCloseTo(compressorOutput(settings)(-15), 5);
    const inside = soft(-20);
    expect(inside).toBeLessThan(-20);
    expect(inside).toBeGreaterThan(compressorOutput(settings)(-20) - 2);
  });

  test("does nothing at 1:1", () => {
    expect(compressorOutput({ ratio: 1, thresholdDb: -20 })(-5)).toBe(-5);
  });
});

describe("formatting", () => {
  test("names a frequency in Hz and kHz", () => {
    expect(formatHz(120)).toBe("120 Hz");
    expect(formatHz(1200)).toBe("1.2 kHz");
    expect(formatHz(12_000)).toBe("12 kHz");
  });

  test("signs a gain and never prints a negative zero", () => {
    expect(formatDb(3)).toBe("+3.0 dB");
    expect(formatDb(-6.5)).toBe("-6.5 dB");
    expect(formatDb(-0.01)).toBe("0.0 dB");
  });
});

describe("sampleRate", () => {
  const peak = { frequency: 12_000, gainDb: 12, q: 3, type: "peak" } as const;

  test("defaults to 48 kHz", () => {
    const explicit = biquadResponse({ ...peak, sampleRate: 48_000 });
    expect(biquadResponse(peak)(13_000)).toBe(explicit(13_000));
  });

  test("bends the top of the curve at another rate, and not the bottom", () => {
    const at44 = biquadResponse({ ...peak, sampleRate: 44_100 });
    const at48 = biquadResponse(peak);
    expect(Math.abs(at44(13_000) - at48(13_000))).toBeGreaterThan(0.3);
    expect(Math.abs(at44(100) - at48(100))).toBeLessThan(0.01);
  });

  test("reaches every band of an equalizer", () => {
    const bands = [{ ...peak, sampleRate: 44_100 }];
    expect(eqResponse(bands)(13_000)).toBe(
      biquadResponse({ ...peak, sampleRate: 44_100 })(13_000)
    );
  });
});
