import { describe, expect, test } from "bun:test";
import type { LibraryDevice } from "@/registry-audio/bases/base/lib/device-library";
import { createVoicePool } from "@/registry-audio/bases/base/lib/voice-pool";

/** An instrument whose engines write down what they are asked. */
function instrument(mono: boolean) {
  const calls: string[][] = [];
  const entry = {
    create: () => {
      const log: string[] = [];
      calls.push(log);
      return {
        dispose: () => undefined,
        noteOff: ({ id }: { id?: number | string } = {}) =>
          log.push(`off ${id}`),
        noteOn: (_note: unknown, { id }: { id?: number | string } = {}) =>
          log.push(`on ${id}`),
        output: { connect: () => undefined },
        update: () => undefined,
      };
    },
    device: { note: [] },
    mono,
    shelf: "Instruments",
  } as unknown as LibraryDevice;
  return { calls, entry };
}

const ctx = {} as BaseAudioContext;
const output = {} as AudioNode;
const NOTE = { pitch: 60, velocity: 1 };

describe("createVoicePool", () => {
  test("a new note past the last voice takes the place of the one held longest", () => {
    const { calls, entry } = instrument(false);
    const pool = createVoicePool(ctx, entry, {}, undefined, 2, output);
    pool.noteOn(NOTE, 0, "a");
    pool.noteOn(NOTE, 1, "b");
    pool.noteOn(NOTE, 2, "c");
    expect(calls).toEqual([["on a", "off a", "on c"], ["on b"]]);
  });

  test("a mono instrument is one engine, given every note and every note off", () => {
    const { calls, entry } = instrument(true);
    const pool = createVoicePool(ctx, entry, {}, undefined, 8, output);
    pool.noteOn(NOTE, 0, "a");
    pool.noteOn(NOTE, 1, "b");
    pool.noteOff(2, "a");
    pool.noteOff(3, "x");
    pool.release(4);
    expect(calls).toEqual([["on a", "on b", "off a", "off b"]]);
  });
});
