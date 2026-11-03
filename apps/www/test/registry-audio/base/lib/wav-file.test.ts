import { describe, expect, test } from "bun:test";
import { encodeWav } from "@/registry-audio/bases/base/lib/wav-file";

const text = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.slice(offset, offset + length));

describe("encodeWav", () => {
  test("writes the RIFF header of PCM: its channels, its rate and how long it is", () => {
    const bytes = encodeWav([new Float32Array(3), new Float32Array(3)], 48_000);
    const view = new DataView(bytes.buffer);
    expect(text(bytes, 0, 4)).toBe("RIFF");
    expect(text(bytes, 8, 4)).toBe("WAVE");
    expect(text(bytes, 12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint32(28, true)).toBe(48_000 * 4);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(bytes, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(12);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
  });

  test("interleaves the channels, frame by frame, and clips past full scale", () => {
    const bytes = encodeWav(
      [Float32Array.of(1, -1, 0.5), Float32Array.of(-2, 2, 0)],
      44_100
    );
    const view = new DataView(bytes.buffer);
    const samples = Array.from({ length: 6 }, (_, index) =>
      view.getInt16(44 + index * 2, true)
    );
    expect(samples).toEqual([32_767, -32_768, -32_768, 32_767, 16_384, 0]);
  });

  test("24 bits take three bytes a sample, low byte first", () => {
    const bytes = encodeWav([Float32Array.of(-1, 1)], 44_100, { bitDepth: 24 });
    const view = new DataView(bytes.buffer);
    expect(view.getUint16(34, true)).toBe(24);
    expect(view.getUint32(40, true)).toBe(6);
    const read = (offset: number) =>
      ((view.getUint8(offset + 2) << 24) |
        (view.getUint8(offset + 1) << 16) |
        (view.getUint8(offset) << 8)) >>
      8;
    expect(read(44)).toBe(-8_388_608);
    expect(read(47)).toBe(8_388_607);
  });

  test("normalized, the loudest sample reaches full scale and the rest follow it", () => {
    const bytes = encodeWav([Float32Array.of(0.25, -0.125)], 44_100, {
      normalize: true,
    });
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(44, true)).toBe(32_767);
    expect(view.getInt16(46, true)).toBe(-16_384);
  });
});
