/** The checks of docs/daw-spec/export.md. */
import {
  assert,
  type Checks,
  dropChord,
  EXPORT,
  open,
  selectTime,
  UNITS,
} from "../helpers";

export const checks: Checks = {
  "EXP-001: export renders the main output to a 24-bit stereo WAV, to the end of the last clip":
    async (browser) => {
      const page = await open(browser);
      // Zoomed in, with no grid to snap to, 10 px from the start is a fraction of a second in.
      await page.keyboard.press("Meta+Equal");
      await page.keyboard.press("Meta+Equal");
      await page.keyboard.press("Meta+Digit4");
      await dropChord(page, '[data-track="track-1"]', "Chord take", 2);
      await page
        .locator("[data-clip-id]", { hasText: "Chord take" })
        .waitFor({ timeout: 30_000 });
      const download = page.waitForEvent("download", { timeout: 30_000 });
      await page.getByRole("button", { name: "More controls" }).click();
      await page.getByRole("menuitem", { name: EXPORT }).click();
      const file = await (await download).path();
      const bytes = new DataView(await Bun.file(file).arrayBuffer());
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
  "EXP-001: the export shortcut pressed again while it renders starts no second render":
    async (browser) => {
      const page = await open(browser);
      // A clip to render: each render ends in a download.
      await dropChord(page, '[data-track="track-1"]', "Chord take", 2);
      await page
        .locator("[data-clip-id]", { hasText: "Chord take" })
        .waitFor({ timeout: 30_000 });
      let renders = 0;
      page.on("download", () => {
        renders += 1;
      });
      const first = page.waitForEvent("download", { timeout: 30_000 });
      await page.keyboard.press("Meta+Shift+KeyR");
      await page.keyboard.press("Meta+Shift+KeyR");
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
    const download = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("button", { name: "More controls" }).click();
    await page.getByRole("menuitem", { name: EXPORT }).click();
    const file = await (await download).path();
    const bytes = new DataView(await Bun.file(file).arrayBuffer());
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
