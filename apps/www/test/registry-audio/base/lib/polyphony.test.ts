import { describe, expect, test } from "bun:test";
import type { NoteTiming } from "@audio-ui/core/device";
import { createPolyphony } from "@/registry-audio/bases/base/lib/polyphony";

/** Engines that write down what they are asked, one log each. */
function voices(count: number) {
  const logs = Array.from({ length: count }, () => [] as string[]);
  const write = (timing: NoteTiming = {}) =>
    timing.at === undefined ? `${timing.id}` : `${timing.id}@${timing.at}`;
  const engines = logs.map((log) => ({
    noteOff: (timing?: NoteTiming) => log.push(`off ${write(timing)}`),
    noteOn: (note: string, timing?: NoteTiming) =>
      log.push(`on ${note} ${write(timing)}`),
  }));
  return { logs, polyphony: createPolyphony(engines) };
}

describe("createPolyphony", () => {
  test("a note past the last voice lets the one held longest go and takes its voice", () => {
    const { logs, polyphony } = voices(2);
    polyphony.noteOn("C", "a");
    polyphony.noteOn("E", "b");
    polyphony.noteOn("G", "c");
    expect(logs).toEqual([["on C a", "off a", "on G c"], ["on E b"]]);
  });

  test("a note started again while held stays on its voice and keeps its age", () => {
    const { logs, polyphony } = voices(2);
    polyphony.noteOn("C", "a");
    polyphony.noteOn("E", "b");
    polyphony.noteOn("D", "a");
    // "a" came first, so it is still the one given up.
    polyphony.noteOn("G", "c");
    expect(logs).toEqual([["on C a", "on D a", "off a", "on G c"], ["on E b"]]);
  });

  test("a note let go frees its voice, and a note nobody holds lets nothing go", () => {
    const { logs, polyphony } = voices(2);
    polyphony.noteOn("C", "a");
    polyphony.noteOn("E", "b");
    polyphony.noteOff("a");
    polyphony.noteOff("x");
    polyphony.noteOn("G", "c");
    expect(logs).toEqual([["on C a", "off a", "on G c"], ["on E b"]]);
  });

  test("release lets every note go at the time it is given, and only those held", () => {
    const { logs, polyphony } = voices(3);
    polyphony.noteOn("C", "a", 1);
    polyphony.noteOn("E", "b", 1);
    polyphony.release(2);
    polyphony.release(3);
    expect(logs).toEqual([
      ["on C a@1", "off a@2"],
      ["on E b@1", "off b@2"],
      [],
    ]);
  });

  test("with no voices, a note plays nowhere", () => {
    const polyphony = createPolyphony<string>([]);
    expect(() => polyphony.noteOn("C", "a")).not.toThrow();
  });
});
