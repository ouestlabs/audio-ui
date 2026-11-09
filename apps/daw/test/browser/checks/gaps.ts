/** The checks of docs/daw-spec/gaps.md. */
import {
  assert,
  type Checks,
  dropChord,
  loudest,
  open,
  showMixer,
} from "../helpers";

export const checks: Checks = {
  "G-013: a dropped file plays streamed from its cache, and comes back from it without decoding":
    async (browser) => {
      const context = await browser.newContext({
        viewport: { height: 1000, width: 1440 },
      });
      const shared = await context.newPage();
      await shared.addInitScript(() => {
        const decode = BaseAudioContext.prototype.decodeAudioData;
        const scope = window as unknown as { decoded: number };
        scope.decoded = 0;
        BaseAudioContext.prototype.decodeAudioData = function (
          this: BaseAudioContext,
          ...args: Parameters<BaseAudioContext["decodeAudioData"]>
        ) {
          scope.decoded += 1;
          return decode.apply(this, args);
        };
      });
      const page = await open(browser, shared);
      await dropChord(page, "[data-add-track]", "Streamed take", 4);
      await page.waitForSelector('[aria-label="Streamed take"][data-track-id]');
      await page.waitForSelector("text=Saved", { timeout: 5000 });
      const cached = await page.evaluate(async () => {
        const folder = await (
          await navigator.storage.getDirectory()
        ).getDirectoryHandle("cache");
        const [samples] = (await Array.fromAsync(folder.keys())).filter(
          (name) => name.endsWith(".f32")
        );
        return (await (await folder.getFileHandle(samples ?? "")).getFile())
          .size;
      });
      // Two channels of 4 s at 48 kHz, as 32-bit floats.
      assert(cached === 2 * 4 * 48_000 * 4, `the cache holds ${cached} bytes`);
      const played = async () => {
        await showMixer(page);
        await page.keyboard.press("Home");
        await page.keyboard.press("Space");
        const level = await loudest(page, 1500);
        await page.keyboard.press("Space");
        return level;
      };
      const first = await played();
      assert(first > -40, `the streamed take plays at ${first} dB`);
      await open(browser, page);
      await page.waitForSelector(
        '[aria-label="Streamed take"][data-track-id]',
        { timeout: 10_000 }
      );
      const again = await played();
      const decoded = await page.evaluate(
        () => (window as unknown as { decoded: number }).decoded
      );
      assert(decoded === 0, `the project decoded ${decoded} files again`);
      // Its peaks came back from the cache too: the waveform reaches past the middle line.
      const reach = await page
        .locator("[data-slot=timeline-clip-waveform]")
        .first()
        .evaluate((element) => {
          const drawn = element as HTMLCanvasElement;
          const row = drawn
            .getContext("2d")
            ?.getImageData(0, 1, drawn.width, drawn.height / 2 - 2).data;
          return row?.some((value, index) => index % 4 === 3 && value > 0);
        });
      assert(reach, "the waveform came back flat");
      assert(again > -40, `the take reopened plays at ${again} dB`);
    },
};
