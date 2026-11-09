/** The checks of docs/daw-spec/export.md. */
import type { Page } from "playwright-core";
import {
  assert,
  type Checks,
  dropChord,
  EXPORT,
  open,
  selectTime,
  UNITS,
} from "../helpers";

/** Picks `option` in the export dialog's select named `field`. */
async function choose(page: Page, field: string, option: string) {
  await page.getByRole("combobox", { name: field }).click();
  await page.getByRole("option", { name: option }).click();
}

/** What the export dialog is set to before Export: a format, a level. */
interface Pick {
  format?: string;
  normalize?: string;
}

/**
 * Exports through the dialog, and reads the file back with the browser's own
 * decoder: its channels, frames and loudest sample. It decodes at `rate`, or
 * at a WAV's own, read from its header, since a decoder resamples to its
 * context and a resampled waveform peaks elsewhere.
 */
async function exported(page: Page, pick: Pick = {}, rate?: number) {
  const download = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: "More controls" }).click();
  await page.getByRole("menuitem", { name: EXPORT }).click();
  if (pick.format) {
    await choose(page, "Format", pick.format);
  }
  if (pick.normalize) {
    await choose(page, "Normalize", pick.normalize);
  }
  await page.getByRole("button", { exact: true, name: "Export" }).click();
  const file = await download;
  const bytes = await Bun.file(await file.path()).arrayBuffer();
  const header = new DataView(bytes);
  const decodeRate =
    rate ??
    (header.getUint32(0) === 0x52_49_46_46
      ? header.getUint32(24, true)
      : 48_000);
  const decoded = await page.evaluate(
    async ([base64, sampleRate]) => {
      const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const buffer = await new OfflineAudioContext(
        1,
        1,
        sampleRate
      ).decodeAudioData(data.buffer);
      let peak = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        for (const sample of buffer.getChannelData(channel)) {
          peak = Math.max(peak, Math.abs(sample));
        }
      }
      return { channels: buffer.numberOfChannels, frames: buffer.length, peak };
    },
    [Buffer.from(bytes).toString("base64"), decodeRate] as const
  );
  return {
    bytes,
    name: file.suggestedFilename(),
    rate: decodeRate,
    ...decoded,
  };
}

/** Drops a chord of `seconds` on the first audio track and waits for its clip. */
async function withChord(page: Page, seconds = 2) {
  await dropChord(page, '[data-track="track-1"]', "Chord take", seconds);
  await page
    .locator("[data-clip-id]", { hasText: "Chord take" })
    .waitFor({ timeout: 30_000 });
}

export const checks: Checks = {
  "EXP-003: FLAC and MP3 exports decode in the browser, as long as the WAV":
    async (browser) => {
      const page = await open(browser);
      await withChord(page);
      const wav = await exported(page);
      const flac = await exported(page, { format: "FLAC" }, wav.rate);
      const mp3 = await exported(page, { format: "MP3" }, wav.rate);
      assert(
        flac.name === "arrangement.flac" && mp3.name === "arrangement.mp3",
        `saved as ${flac.name} and ${mp3.name}`
      );
      assert(
        flac.channels === 2 && flac.frames === wav.frames,
        `the FLAC has ${flac.channels} channels and ${flac.frames} frames, the WAV ${wav.frames}`
      );
      // An MP3 decoder may keep part of the encoder's delay: two frames of 1152 samples, at most.
      assert(
        mp3.channels === 2 && Math.abs(mp3.frames - wav.frames) <= 2304,
        `the MP3 has ${mp3.channels} channels and ${mp3.frames} frames, the WAV ${wav.frames}`
      );
    },
  "EXP-005: normalized to its peak, the file's loudest sample is at full scale":
    async (browser) => {
      const page = await open(browser);
      await withChord(page);
      const { peak } = await exported(page, { normalize: "Peak, 0 dBFS" });
      assert(
        Math.abs(peak - 1) < 2 ** -20,
        `its loudest sample is ${peak}, not 1`
      );
    },
  "EXP-010: the notice of a finished export says how loud the file is": async (
    browser
  ) => {
    const page = await open(browser);
    await withChord(page);
    await exported(page, { normalize: "Streaming, -14 LUFS" });
    const notice = page
      .locator("[data-sonner-toast]", { hasText: "Exported to" })
      .first();
    const text = (await notice.textContent()) ?? "";
    assert(
      text.includes("LUFS") && text.includes("dBTP"),
      `the notice reads "${text}"`
    );
  },
  "EXP-001: export renders the main output to a 24-bit stereo WAV, to the end of the last clip":
    async (browser) => {
      const page = await open(browser);
      // Zoomed in, with no grid to snap to, 10 px from the start is a fraction of a second in.
      await page.keyboard.press("Meta+Equal");
      await page.keyboard.press("Meta+Equal");
      await page.keyboard.press("Meta+Digit4");
      await withChord(page);
      const { bytes: file } = await exported(page);
      const bytes = new DataView(file);
      const channels = bytes.getUint16(22, true);
      const bits = bytes.getUint16(34, true);
      const seconds =
        bytes.getUint32(40, true) /
        (channels * (bits / 8) * bytes.getUint32(24, true));
      assert(
        channels === 2 && bits === 24,
        `${channels} channels, ${bits} bits`
      );
      assert(
        seconds > 2 && seconds < 3,
        `it lasts ${seconds} s for a clip of 2 s dropped half a second in`
      );
    },
  "EXP-001: Export pressed again while a render runs starts no second render":
    async (browser) => {
      const page = await open(browser);
      // A clip to render: each render ends in a download.
      await withChord(page);
      let renders = 0;
      page.on("download", () => {
        renders += 1;
      });
      const first = page.waitForEvent("download", { timeout: 30_000 });
      const press = page.getByRole("button", { exact: true, name: "Export" });
      await page.keyboard.press("Meta+Shift+KeyR");
      await press.click();
      await page.keyboard.press("Meta+Shift+KeyR");
      await press.click();
      await first;
      await page.waitForTimeout(2000);
      assert(renders === 1, `the export rendered ${renders} times, not once`);
    },
  "EXP-002: with time selected, the export renders that stretch": async (
    browser
  ) => {
    const page = await open(browser);
    await dropChord(page, '[data-track="track-1"]', "Take", 8);
    await page.waitForSelector("[data-clip-id]", { timeout: 10_000 });
    await selectTime(page, "track-2", "track-2", 90);
    const width = await page
      .locator("[data-slot=timeline-time-selection]")
      .first()
      .evaluate((element) => (element as HTMLElement).style.width);
    const expected = Number(UNITS.exec(width)?.[1]);
    const { bytes: file } = await exported(page);
    const bytes = new DataView(file);
    const seconds =
      bytes.getUint32(40, true) /
      (bytes.getUint16(22, true) *
        (bytes.getUint16(34, true) / 8) *
        bytes.getUint32(24, true));
    assert(
      Math.abs(seconds - expected) < 0.01,
      `it lasts ${seconds} s for ${expected} s selected`
    );
  },
};
