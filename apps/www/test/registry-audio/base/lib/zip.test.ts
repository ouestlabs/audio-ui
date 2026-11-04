import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { crc32, createZip, readZip } from "@/registry-audio/bases/base/lib/zip";

const text = async (entry: { read: () => Promise<ArrayBuffer> } | undefined) =>
  new TextDecoder().decode(await entry?.read());

describe("zip", () => {
  test("PRJ-008: the CRC-32 of a known string", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcb_f4_39_26);
  });

  test("PRJ-008: an archive written comes back file for file, its paths as they were", async () => {
    const audio = Uint8Array.from({ length: 4096 }, (_, index) => index % 251);
    const zip = await createZip([
      { data: "<Project/>", path: "project.xml" },
      { data: audio, path: "audio/Kick drum é.wav" },
      { data: new Blob(["<MetaData/>"]), path: "metadata.xml" },
    ]);
    const entries = await readZip(zip);
    expect([...entries.keys()]).toEqual([
      "project.xml",
      "audio/Kick drum é.wav",
      "metadata.xml",
    ]);
    expect(await text(entries.get("project.xml"))).toBe("<Project/>");
    expect(await text(entries.get("metadata.xml"))).toBe("<MetaData/>");
    const read = await entries.get("audio/Kick drum é.wav")?.read();
    expect(new Uint8Array(read ?? new ArrayBuffer(0))).toEqual(audio);
    expect(entries.get("audio/Kick drum é.wav")?.size).toBe(4096);
  });

  test("PRJ-008: a deflated file, as other programs write them, is read too", async () => {
    const plain = new TextEncoder().encode(
      '<Project version="1.0"/>'.repeat(40)
    );
    const packed = deflateRawSync(plain);
    const name = new TextEncoder().encode("project.xml");
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04_03_4b_50, true);
    local.setUint16(8, 8, true);
    local.setUint32(18, packed.length, true);
    local.setUint32(22, plain.length, true);
    local.setUint16(26, name.length, true);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02_01_4b_50, true);
    central.setUint16(10, 8, true);
    central.setUint32(20, packed.length, true);
    central.setUint32(24, plain.length, true);
    central.setUint16(28, name.length, true);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06_05_4b_50, true);
    end.setUint16(8, 1, true);
    end.setUint16(10, 1, true);
    end.setUint32(12, 46 + name.length, true);
    end.setUint32(16, 30 + name.length + packed.length, true);
    const zip = new Blob([local, name, packed, central, name, end]);
    expect(await text((await readZip(zip)).get("project.xml"))).toBe(
      new TextDecoder().decode(plain)
    );
  });

  test("PRJ-008: what is not a zip is refused, saying so", async () => {
    await expect(readZip(new Blob(["not a zip"]))).rejects.toThrow("not a zip");
  });
});
