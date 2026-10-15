import { describe, expect, test } from "bun:test";
import { parseMidiMessage, pitchBendToSemitones } from "./message.ts";

describe("parseMidiMessage", () => {
  test("reads a note on with its channel and a velocity from 0 to 1", () => {
    expect(parseMidiMessage(new Uint8Array([0x93, 60, 127]))).toEqual({
      channel: 3,
      note: 60,
      type: "noteon",
      velocity: 1,
    });
    expect(parseMidiMessage([0x90, 69, 64])).toMatchObject({
      note: 69,
      velocity: 64 / 127,
    });
  });

  test("reads a note on with velocity 0 as a note off", () => {
    expect(parseMidiMessage([0x90, 60, 0])).toEqual({
      channel: 0,
      note: 60,
      type: "noteoff",
      velocity: 0,
    });
  });

  test("reads a note off with its release velocity", () => {
    expect(parseMidiMessage([0x8f, 72, 64])).toEqual({
      channel: 15,
      note: 72,
      type: "noteoff",
      velocity: 64 / 127,
    });
  });

  test("reads a control change", () => {
    expect(parseMidiMessage([0xb1, 64, 127])).toEqual({
      channel: 1,
      controller: 64,
      type: "controlchange",
      value: 1,
    });
    expect(parseMidiMessage([0xb0, 123, 0])).toMatchObject({
      controller: 123,
      value: 0,
    });
  });

  test("reads pitch bend from -1 to 1, LSB first, 8192 at rest", () => {
    const bend = (lsb: number, msb: number) =>
      parseMidiMessage([0xe0, lsb, msb]);
    expect(bend(0x00, 0x40)).toEqual({
      channel: 0,
      type: "pitchbend",
      value: 0,
    });
    // Both ends are reached: 0 is -1 and 16383 is +1.
    expect(bend(0x00, 0x00)).toMatchObject({ value: -1 });
    expect(bend(0x7f, 0x7f)).toMatchObject({ value: 1 });
    // The least significant byte is the first one.
    expect(bend(0x01, 0x40)).toMatchObject({ value: 1 / 8191 });
    expect(bend(0x00, 0x41)?.type).toBe("pitchbend");
    const halfUp = bend(0x00, 0x60);
    expect(halfUp && "value" in halfUp ? halfUp.value : 0).toBeCloseTo(0.5, 2);
  });

  test("is null for messages it does not read", () => {
    expect(parseMidiMessage([0xc0, 5, 0])).toBeNull(); // program change
    expect(parseMidiMessage([0xa0, 60, 40])).toBeNull(); // key pressure
    expect(parseMidiMessage([0xd0, 40, 0])).toBeNull(); // channel pressure
    expect(parseMidiMessage([0xf8, 0, 0])).toBeNull(); // timing clock
    expect(parseMidiMessage([0xf0, 1, 2])).toBeNull(); // system exclusive
  });

  test("is null for bytes that are no message", () => {
    expect(parseMidiMessage(null)).toBeNull();
    expect(parseMidiMessage(undefined)).toBeNull();
    expect(parseMidiMessage([])).toBeNull();
    expect(parseMidiMessage([0x90, 60])).toBeNull(); // too short
    expect(parseMidiMessage([60, 60, 60])).toBeNull(); // no status byte
    expect(parseMidiMessage([0x90, 200, 64])).toBeNull(); // data byte over 127
    expect(parseMidiMessage([0x90, 60, 128])).toBeNull();
  });
});

describe("pitchBendToSemitones", () => {
  test("scales to the receiver's range, two semitones by default", () => {
    expect(pitchBendToSemitones(1)).toBe(2);
    expect(pitchBendToSemitones(-0.5)).toBe(-1);
    expect(pitchBendToSemitones(1, 12)).toBe(12);
  });
});
