import { describe, expect, test } from "bun:test";
import {
  bandGainForHandle,
  bandHandleDb,
  biquadResponse,
  compressorOutput,
  eqResponse,
  formatDb,
  formatHz,
  toWebAudioQ,
  webAudioCompressorOutput,
} from "./index.ts";

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

describe("against the browser's own BiquadFilterNode", () => {
  // `getFrequencyResponse` of Chrome's node, read at 50, 200, 1000, 2000, 5000
  // and 12000 Hz, for the type and settings given, with the node's Q set
  // through `toWebAudioQ`. The curve must be the one heard.
  const HZ = [50, 200, 1000, 2000, 5000, 12_000];
  const chrome = [
    {
      chrome: [-52.047, -27.676, 6.021, 2.023, 0.287, 0.033],
      frequency: 1000,
      q: 2,
      type: "lowcut",
    },
    {
      chrome: [0.005, 0.084, 2.357, 12.041, -15.094, -35.076],
      frequency: 2000,
      q: 4,
      type: "highcut",
    },
    {
      chrome: [-31.132, -7.828, -0.035, -0.002, 0, 0],
      frequency: 300,
      q: Math.SQRT1_2,
      type: "lowcut",
    },
    {
      chrome: [9, 8.983, 4.5, 0.6, 0.015, 0],
      frequency: 1000,
      gainDb: 9,
      q: 4,
      type: "lowshelf",
    },
    {
      chrome: [0, 0, -0.023, -0.353, -4.281, -5.967],
      frequency: 4000,
      gainDb: -6,
      q: 0.5,
      type: "highshelf",
    },
    {
      chrome: [0.001, 0.012, 0.484, 9, 0.239, 0.021],
      frequency: 2000,
      gainDb: 9,
      q: 3,
      type: "peak",
    },
    {
      chrome: [-32.035, -19.705, 0, -10.056, -20.019, -29.657],
      frequency: 1000,
      q: 2,
      type: "bandpass",
    },
  ] as const;

  for (const { chrome: expected, ...settings } of chrome) {
    test(`${settings.type} at ${settings.frequency} Hz, Q ${settings.q.toFixed(2)}, within 0.05 dB`, () => {
      const response = biquadResponse(settings);
      HZ.forEach((hz, index) => {
        expect(Math.abs(response(hz) - (expected[index] ?? 0))).toBeLessThan(
          0.05
        );
      });
    });
  }

  test("a notch's null is as deep as the node's", () => {
    const response = biquadResponse({ frequency: 1000, q: 4, type: "notch" });
    expect(response(1000)).toBeLessThan(-100);
    expect(Math.abs(response(2000) - -0.117)).toBeLessThan(0.05);
  });
});

describe("toWebAudioQ", () => {
  test("gives a low-pass and a high-pass a Q in decibels, and every other type its own", () => {
    expect(toWebAudioQ("lowcut", 1)).toBeCloseTo(0, 12);
    expect(toWebAudioQ("highcut", 2)).toBeCloseTo(6.0206, 4);
    expect(toWebAudioQ("lowcut", Math.SQRT1_2)).toBeCloseTo(-3.0103, 4);
    expect(toWebAudioQ("peak", 3)).toBe(3);
    expect(toWebAudioQ("notch", 0.4)).toBe(0.4);
    expect(toWebAudioQ("lowshelf", 5)).toBe(5);
  });

  test("defaults to the flat Q and never returns -Infinity or NaN", () => {
    expect(toWebAudioQ("peak")).toBe(Math.SQRT1_2);
    expect(Number.isFinite(toWebAudioQ("lowcut", 0))).toBe(true);
    expect(Number.isFinite(toWebAudioQ("highcut", -3))).toBe(true);
  });
});

describe("shelves have the node's fixed slope", () => {
  test("ignore Q", () => {
    for (const type of ["lowshelf", "highshelf"] as const) {
      const flat = biquadResponse({ frequency: 1000, gainDb: 9, type });
      const resonant = biquadResponse({
        frequency: 1000,
        gainDb: 9,
        q: 4,
        type,
      });
      for (const hz of [100, 800, 1000, 1500, 8000]) {
        expect(resonant(hz)).toBe(flat(hz));
      }
    }
  });
});

describe("webAudioCompressorOutput", () => {
  // The peak in dBFS of a sine of the input level through Chrome's
  // DynamicsCompressorNode, steady state, attack 3 ms, release 250 ms.
  const measured: [
    thresholdDb: number,
    kneeDb: number,
    ratio: number,
    Record<number, number>,
  ][] = [
    [
      -24,
      0,
      4,
      {
        "-60": -49.2,
        "-40": -29.2,
        "-30": -19.2,
        "-24": -13.2,
        "-18": -11.57,
        "-12": -9.99,
        "-6": -8.46,
        "0": -6.92,
      },
    ],
    [
      -24,
      30,
      4,
      {
        "-60": -57.61,
        "-40": -37.61,
        "-30": -27.61,
        "-24": -21.61,
        "-18": -15.75,
        "-12": -10.27,
        "-6": -5.38,
        "0": -1.49,
      },
    ],
    [
      -12,
      0,
      12,
      {
        "-60": -53.4,
        "-40": -33.4,
        "-30": -23.4,
        "-24": -17.4,
        "-18": -11.4,
        "-12": -5.4,
        "-6": -4.74,
        "0": -4.16,
      },
    ],
  ];

  for (const [thresholdDb, kneeDb, ratio, row] of measured) {
    test(`threshold ${thresholdDb}, knee ${kneeDb}, ratio ${ratio}: exact below the threshold, within 0.3 dB above`, () => {
      const output = webAudioCompressorOutput({ kneeDb, ratio, thresholdDb });
      for (const [input, expected] of Object.entries(row)) {
        const tolerance = Number(input) <= thresholdDb ? 0.02 : 0.3;
        expect(Math.abs(output(Number(input)) - expected)).toBeLessThan(
          tolerance
        );
      }
    });
  }

  test("adds the node's own make-up gain: 0.6 of what the curve takes off at full scale", () => {
    const output = webAudioCompressorOutput({
      kneeDb: 0,
      ratio: 4,
      thresholdDb: -24,
    });
    // Full scale comes out at -24 + 24 / 4 = -18, so 10.8 dB is added.
    expect(output(-60)).toBeCloseTo(-60 + 10.8, 6);
  });

  test("is not the textbook curve, which has no make-up and a centred knee", () => {
    const settings = { kneeDb: 30, ratio: 4, thresholdDb: -24 };
    expect(webAudioCompressorOutput(settings)(-60)).not.toBe(
      compressorOutput(settings)(-60)
    );
  });

  test("never lets the output rise above the input by more than the make-up", () => {
    const output = webAudioCompressorOutput({
      kneeDb: 6,
      ratio: 8,
      thresholdDb: -20,
    });
    let previous = Number.NEGATIVE_INFINITY;
    for (let db = -80; db <= 0; db += 1) {
      const out = output(db);
      expect(out).toBeGreaterThanOrEqual(previous);
      previous = out;
    }
  });
});

describe("readouts that cannot read", () => {
  test("format nothing for a value that is not a number", () => {
    expect(formatHz(Number.NaN)).toBe("");
    expect(formatDb(Number.NaN)).toBe("");
    expect(formatDb(Number.NEGATIVE_INFINITY)).toBe("-∞ dB");
  });
});
