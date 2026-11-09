/** The checks of docs/daw-spec/transport.md. */
import {
  assert,
  type Checks,
  dropChord,
  loudest,
  open,
  selectTime,
  showMixer,
} from "../helpers";

export const checks: Checks = {
  "TRN-001: Space plays from the start marker, and stops": async (browser) => {
    const page = await open(browser);
    await dropChord(page, "[data-add-track]", "Chord take");
    await page.waitForSelector('[aria-label="Chord take"][data-track-id]');
    await showMixer(page);
    await page.keyboard.press("Home");
    await page.keyboard.press("Space");
    await page.waitForSelector('[aria-label="Pause"]', { timeout: 5000 });
    const level = await loudest(page, 1000);
    assert(
      level > -40,
      `the main track is near silent while the clip plays (${level} dB)`
    );
    await page.keyboard.press("Space");
    await page.waitForSelector('[aria-label="Play"]', { timeout: 5000 });
  },
  "TRN-007: Cmd+L loops the time selected, and turns the loop on": async (
    browser
  ) => {
    const page = await open(browser);
    const loop = page.locator("[data-slot=timeline-range]").first();
    const wide = (await loop.boundingBox())?.width ?? 0;
    await selectTime(page, "track-2", "track-2", 90);
    const selected = await page
      .locator("[data-slot=timeline-time-selection]")
      .first()
      .boundingBox();
    assert(selected, "the time selected is drawn");
    await page.keyboard.press("Meta+KeyL");
    await page.waitForFunction(
      ([from, width]) => {
        const range = document.querySelector("[data-slot=timeline-range]");
        return (
          range !== null &&
          Math.abs(range.getBoundingClientRect().width - (width as number)) <
            2 &&
          from !== width
        );
      },
      [wide, selected.width]
    );
  },
  "TRN-016: the metronome clicks while it is on, and stops when it is off":
    async (browser) => {
      const context = await browser.newContext({
        viewport: { height: 1000, width: 1440 },
      });
      const shared = await context.newPage();
      await shared.addInitScript(() => {
        const started = OscillatorNode.prototype.start;
        const scope = window as unknown as { oscillators: number };
        scope.oscillators = 0;
        OscillatorNode.prototype.start = function (when) {
          scope.oscillators += 1;
          started.call(this, when);
        };
      });
      const page = await open(browser, shared);
      const count = () =>
        page.evaluate(
          () => (window as unknown as { oscillators: number }).oscillators
        );
      await page.keyboard.press("Space");
      await page.waitForTimeout(1200);
      assert(
        (await count()) === 0,
        `${await count()} clicks with the metronome off`
      );
      const metronome = page.getByRole("button", {
        exact: true,
        name: "Metronome",
      });
      await metronome.click();
      await page.waitForTimeout(1600);
      const clicked = await count();
      // At 120 BPM, a click each half second.
      assert(clicked >= 2, `${clicked} clicks in 1.6 seconds at 120 BPM`);
      await metronome.click();
      await page.waitForTimeout(150);
      const after = await count();
      await page.waitForTimeout(1200);
      assert((await count()) === after, "the metronome kept clicking once off");
      await page.keyboard.press("Space");
    },
};
