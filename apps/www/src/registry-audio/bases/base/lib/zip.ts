/**
 * Zip archives, as an exchange format packs a project and its files: written
 * with every file stored as it is (audio does not shrink), read back whether
 * its files are stored or deflated, through the browser's own
 * `DecompressionStream`. Archives past 4 GB (Zip64) are refused, saying so.
 */

/** A file to put in an archive: its path in it, and its bytes. */
export interface ZipFile {
  data: Blob | Uint8Array<ArrayBuffer> | string;
  path: string;
}

/** A file of an archive read back: its size, and its bytes when asked for. */
export interface ZipEntry {
  read: () => Promise<ArrayBuffer>;
  size: number;
}

const LOCAL = 0x04_03_4b_50;
const CENTRAL = 0x02_01_4b_50;
const END = 0x06_05_4b_50;
const UTF8 = 0x08_00;
const STORED = 0;
const DEFLATED = 8;
const LIMIT = 0xff_ff_ff_ff;

let table: Uint32Array | null = null;

/** The CRC-32 of bytes, which a zip keeps for each file. */
export function crc32(bytes: Uint8Array, previous = 0): number {
  table ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });
  let crc = ~previous >>> 0;
  for (const byte of bytes) {
    crc = (table[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return ~crc >>> 0;
}

const bytesOf = async (data: ZipFile["data"]) => {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  return data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
};

/** A header's fixed fields, little-endian, as `[value, bytes]` pairs. */
function header(
  fields: readonly (readonly [number, 2 | 4])[]
): Uint8Array<ArrayBuffer> {
  const size = fields.reduce((sum, [, bytes]) => sum + bytes, 0);
  const view = new DataView(new ArrayBuffer(size));
  let at = 0;
  for (const [value, bytes] of fields) {
    if (bytes === 2) {
      view.setUint16(at, value, true);
    } else {
      view.setUint32(at, value, true);
    }
    at += bytes;
  }
  return new Uint8Array(view.buffer);
}

/** An archive of `files`, each stored as it is, under its path; one file is read at a time, so only one is ever held whole. */
export async function createZip(files: readonly ZipFile[]): Promise<Blob> {
  const parts: BlobPart[] = [];
  const central: BlobPart[] = [];
  const offset = await files.reduce(async (written, file) => {
    const at = await written;
    const data = await bytesOf(file.data);
    const name = new TextEncoder().encode(file.path);
    if (data.length >= LIMIT || at >= LIMIT) {
      throw new Error(
        "The archive would pass 4 GB, which a zip without Zip64 cannot hold."
      );
    }
    const crc = crc32(data);
    const common = [
      [20, 2],
      [UTF8, 2],
      [STORED, 2],
      [0, 2],
      [0x21, 2],
      [crc, 4],
      [data.length, 4],
      [data.length, 4],
      [name.length, 2],
      [0, 2],
    ] as const;
    const local = header([[LOCAL, 4], ...common]);
    parts.push(local, name, data);
    central.push(
      header([
        [CENTRAL, 4],
        [20, 2],
        ...common,
        [0, 2],
        [0, 2],
        [0, 2],
        [0, 4],
        [at, 4],
      ]),
      name
    );
    return at + local.length + name.length + data.length;
  }, Promise.resolve(0));
  const directory = new Blob(central);
  return new Blob([
    ...parts,
    directory,
    header([
      [END, 4],
      [0, 2],
      [0, 2],
      [files.length, 2],
      [files.length, 2],
      [directory.size, 4],
      [offset, 4],
      [0, 2],
    ]),
  ]);
}

const viewOf = async (blob: Blob, from: number, to: number) =>
  new DataView(await blob.slice(from, to).arrayBuffer());

/** The files of an archive, by their path in it; it throws on what is not a zip, or a Zip64 one. */
export async function readZip(blob: Blob): Promise<Map<string, ZipEntry>> {
  const tail = Math.max(0, blob.size - 65_557);
  const end = await viewOf(blob, tail, blob.size);
  let at = end.byteLength - 22;
  while (at >= 0 && end.getUint32(at, true) !== END) {
    at -= 1;
  }
  if (at < 0) {
    throw new Error("This is not a zip archive.");
  }
  const count = end.getUint16(at + 10, true);
  const size = end.getUint32(at + 12, true);
  const start = end.getUint32(at + 16, true);
  if (count === 0xff_ff || start === LIMIT) {
    throw new Error("This archive is a Zip64 one, which cannot be read here.");
  }
  const directory = await viewOf(blob, start, start + size);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  let cursor = 0;
  for (let index = 0; index < count; index += 1) {
    if (directory.getUint32(cursor, true) !== CENTRAL) {
      throw new Error("This archive's directory is broken.");
    }
    const method = directory.getUint16(cursor + 10, true);
    const packed = directory.getUint32(cursor + 20, true);
    const unpacked = directory.getUint32(cursor + 24, true);
    const nameLength = directory.getUint16(cursor + 28, true);
    const extra = directory.getUint16(cursor + 30, true);
    const comment = directory.getUint16(cursor + 32, true);
    const local = directory.getUint32(cursor + 42, true);
    const name = decoder.decode(
      new Uint8Array(
        directory.buffer,
        directory.byteOffset + cursor + 46,
        nameLength
      )
    );
    cursor += 46 + nameLength + extra + comment;
    if (name.endsWith("/")) {
      continue;
    }
    const read = async () => {
      const head = await viewOf(blob, local, local + 30);
      const from =
        local + 30 + head.getUint16(26, true) + head.getUint16(28, true);
      const data = blob.slice(from, from + packed);
      if (method === STORED) {
        return data.arrayBuffer();
      }
      if (method !== DEFLATED) {
        throw new Error(`${name} is packed in a way that cannot be read here.`);
      }
      return new Response(
        data.stream().pipeThrough(new DecompressionStream("deflate-raw"))
      ).arrayBuffer();
    };
    entries.set(name, { read, size: unpacked });
  }
  return entries;
}
