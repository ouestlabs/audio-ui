import { describe, expect, test } from "bun:test";
import {
  type ClipSettings,
  reversedSettings,
  warpMarkersTight,
} from "@/registry-audio/bases/base/audio/panels/clip-panel";

const settings = (patch: Partial<ClipSettings> = {}): ClipSettings => ({
  gain: 0,
  length: 1,
  loop: null,
  offset: 0,
  reversed: false,
  sourceLength: 4,
  transpose: 0,
  warp: null,
  ...patch,
});

describe("reversedSettings", () => {
  test("CLP-008: a reversed clip plays the same stretch of its source, backwards", () => {
    // It played the first second of four: reversed, that second is the last of the mirrored source.
    expect(reversedSettings(settings())).toEqual({ offset: 3, reversed: true });
  });

  test("reversing twice gives the clip back", () => {
    const once = {
      ...settings({ length: 1.5, offset: 0.5 }),
      ...reversedSettings(settings({ length: 1.5, offset: 0.5 })),
    };
    expect({ ...once, ...reversedSettings(once) }).toEqual(
      settings({ length: 1.5, offset: 0.5 })
    );
  });

  test("a looped clip mirrors its loop and starts it from the mirror of where it started", () => {
    expect(
      reversedSettings(settings({ length: 4, loop: [1, 2], offset: 1 }))
    ).toEqual({
      loop: [2, 3],
      offset: 2,
      reversed: true,
    });
  });

  test("a warped clip mirrors across its source as the warp stretches it", () => {
    const warped = settings({
      warp: [
        { source: 0, target: 0 },
        { source: 4, target: 8 },
      ],
    });
    expect(reversedSettings(warped).offset).toBe(7);
  });
});

describe("warpMarkersTight", () => {
  test("CLP-021: markers closer than a handle on average are ticks", () => {
    expect(warpMarkersTight(142, 240, 2.8)).toBe(true);
    expect(warpMarkersTight(142, 240, 100)).toBe(false);
  });

  test("CLP-021: a couple of markers across a wide view keep their handles", () => {
    expect(warpMarkersTight(2, 4, 160)).toBe(false);
  });
});
