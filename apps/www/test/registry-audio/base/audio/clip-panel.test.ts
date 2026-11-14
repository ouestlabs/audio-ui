import { describe, expect, test } from "bun:test";
import {
  type ClipSettings,
  processedSettings,
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

describe("processedSettings", () => {
  const warp = [
    { source: 0, target: 0 },
    { source: 4, target: 8 },
  ];

  test("CLP-028: an operation that keeps the length keeps the clip's start, end, loop and warp", () => {
    const clip = settings({ length: 2, loop: [1, 3], offset: 1, warp });
    expect(
      processedSettings(clip, { target: { lufs: -16 }, type: "normalize" }, 4)
    ).toEqual(clip);
  });

  test("CLP-028: Stretch and Speed scale the clip's times with the sound", () => {
    expect(
      processedSettings(
        settings({ length: 1, loop: [1, 2], offset: 1 }),
        { factor: 2, method: "transient", type: "stretch" },
        8
      )
    ).toEqual(
      settings({ length: 2, loop: [2, 4], offset: 2, sourceLength: 8 })
    );
    expect(
      processedSettings(settings({ length: 4 }), { speed: 2, type: "speed" }, 2)
    ).toEqual(settings({ length: 2, sourceLength: 2 }));
  });

  test("CLP-028: after Repeat, a clip that played to its source's end still does", () => {
    const repeat = { times: 2, type: "repeat" } as const;
    expect(processedSettings(settings({ length: 4 }), repeat, 8)).toEqual(
      settings({ length: 8, sourceLength: 8 })
    );
    // One that stopped before the end keeps its end.
    expect(processedSettings(settings({ length: 1 }), repeat, 8)).toEqual(
      settings({ length: 1, sourceLength: 8 })
    );
    // A loop that reached the end takes in what was added.
    expect(
      processedSettings(
        settings({ length: 8, loop: [2, 4], offset: 2 }),
        repeat,
        8
      )
    ).toEqual(
      settings({ length: 8, loop: [2, 8], offset: 2, sourceLength: 8 })
    );
  });

  test("CLP-028: a reversed clip starts where the silence was added, if it started at its source's end", () => {
    const pad = { seconds: 1, type: "pad" } as const;
    expect(
      processedSettings(settings({ length: 4, reversed: true }), pad, 5)
    ).toEqual(settings({ length: 5, reversed: true, sourceLength: 5 }));
    // One that started inside the source plays the same stretch of it.
    expect(
      processedSettings(
        settings({ length: 1, offset: 1, reversed: true }),
        pad,
        5
      )
    ).toEqual(
      settings({ length: 1, offset: 2, reversed: true, sourceLength: 5 })
    );
  });

  test("CLP-029: Delete on a stretch moves what follows it back, so the clip plays the same sound", () => {
    const remove = { type: "delete" } as const;
    expect(
      processedSettings(settings({ length: 4 }), remove, 3, [1, 2])
    ).toEqual(settings({ length: 3, sourceLength: 3 }));
    expect(
      processedSettings(settings({ length: 1, offset: 2.5 }), remove, 3, [1, 2])
    ).toEqual(settings({ length: 1, offset: 1.5, sourceLength: 3 }));
  });

  test("CLP-029: Paste at a point makes room for itself, Crop keeps the stretch alone", () => {
    expect(
      processedSettings(
        settings({ length: 4 }),
        { channels: [], type: "paste" },
        5,
        [1, 1]
      )
    ).toEqual(settings({ length: 5, sourceLength: 5 }));
    expect(
      processedSettings(settings({ length: 4 }), { type: "crop" }, 2, [1, 3])
    ).toEqual(settings({ length: 2, sourceLength: 2 }));
  });

  test("CLP-029: a stretch made longer scales what is inside it and moves what follows", () => {
    expect(
      processedSettings(
        settings({ length: 2, offset: 1.5 }),
        { factor: 2, method: "transient", type: "stretch" },
        5,
        [1, 2]
      )
    ).toEqual(settings({ length: 2.5, offset: 2, sourceLength: 5 }));
  });

  test("CLP-029: a warped clip is read back as recorded before its warp goes", () => {
    // Its source's 2 s play over the clip's 4 s: the clip's 2 s to 4 s are the source's 1 s to 2 s.
    const warped = settings({
      length: 2,
      offset: 2,
      sourceLength: 2,
      warp: [
        { source: 0, target: 0 },
        { source: 2, target: 4 },
      ],
    });
    expect(
      processedSettings(warped, { type: "delete" }, 1.5, [0, 0.5])
    ).toEqual(settings({ length: 1, offset: 0.5, sourceLength: 1.5 }));
  });

  test("CLP-028: an operation that changes the length turns the warp off first", () => {
    expect(
      processedSettings(
        settings({ length: 8, warp }),
        { times: 2, type: "repeat" },
        8
      )
    ).toEqual(settings({ length: 8, sourceLength: 8 }));
  });
});
