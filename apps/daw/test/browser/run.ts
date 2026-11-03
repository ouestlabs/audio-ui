/**
 * The workstation in Chromium, driven with the mouse and the keyboard as a
 * person would: what docs/daw-spec asks of it end to end. Run the app first
 * (`bun run dev`), then `bun run test:browser`, or name checks:
 * `bun test/browser/run.ts ARR-006`. `DAW_URL` points at another server.
 *
 * Each check opens a fresh profile, so the project starts new, except where
 * a check reloads to see what was kept.
 */
import { type Browser, chromium, type Page } from "playwright-core";

const URL = process.env.DAW_URL ?? "http://localhost:3300/";
const RATE = /kHz/;
const LATENCY = /ms out/;
const EXPORT = /Export WAV/;

/** A WAV file of `seconds` of a chord, made in the page and dropped on `selector`. */
async function dropChord(
  page: Page,
  selector: string,
  name: string,
  seconds = 4
) {
  await page.evaluate(
    ({ name: fileName, seconds: length, selector: target }) => {
      const rate = 48_000;
      const frames = rate * length;
      const data = new DataView(new ArrayBuffer(44 + frames * 4));
      const text = (at: number, value: string) => {
        for (let index = 0; index < value.length; index += 1) {
          data.setUint8(at + index, value.charCodeAt(index));
        }
      };
      text(0, "RIFF");
      data.setUint32(4, 36 + frames * 4, true);
      text(8, "WAVE");
      text(12, "fmt ");
      data.setUint32(16, 16, true);
      data.setUint16(20, 1, true);
      data.setUint16(22, 2, true);
      data.setUint32(24, rate, true);
      data.setUint32(28, rate * 4, true);
      data.setUint16(32, 4, true);
      data.setUint16(34, 16, true);
      text(36, "data");
      data.setUint32(40, frames * 4, true);
      for (let index = 0; index < frames; index += 1) {
        const time = index / rate;
        const value =
          (0.3 *
            (Math.sin(2 * Math.PI * 220 * time) +
              Math.sin(2 * Math.PI * 277.18 * time) +
              Math.sin(2 * Math.PI * 329.63 * time))) /
          3;
        data.setInt16(44 + index * 4, value * 32_767, true);
        data.setInt16(46 + index * 4, value * 32_767, true);
      }
      const file = new File([data.buffer], `${fileName}.wav`, {
        type: "audio/wav",
      });
      const element = document.querySelector(target) as HTMLElement;
      const box = element.getBoundingClientRect();
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const init = {
        bubbles: true,
        cancelable: true,
        clientX: box.left + 10,
        clientY: box.top + 10,
        dataTransfer: transfer,
      };
      element.dispatchEvent(new DragEvent("dragenter", init));
      element.dispatchEvent(new DragEvent("dragover", init));
      element.dispatchEvent(new DragEvent("drop", init));
    },
    { name, seconds, selector }
  );
}

async function open(browser: Browser, shared?: Page) {
  const page =
    shared ??
    (await (
      await browser.newContext({
        acceptDownloads: true,
        viewport: { height: 1000, width: 1440 },
      })
    ).newPage());
  await page.goto(URL);
  await page.waitForSelector("[data-track-id]", { timeout: 30_000 });
  return page;
}

/** Opens the mixer, where the main track's meter is. */
async function showMixer(page: Page) {
  await page.keyboard.press("Meta+Alt+KeyM");
  await page.waitForSelector('[aria-label="Main level"]');
}

/** The loudest the main track's meter reads, in dB, over `ms` of playback. */
function loudest(page: Page, ms: number) {
  return page.evaluate(
    (duration) =>
      new Promise<number>((resolve) => {
        let top = Number.NEGATIVE_INFINITY;
        const meter = document.querySelector(
          '[aria-label="Main level"] [aria-valuenow]'
        );
        const read = () => {
          top = Math.max(
            top,
            Number(meter?.getAttribute("aria-valuenow") ?? top)
          );
        };
        const timer = setInterval(read, 20);
        setTimeout(() => {
          clearInterval(timer);
          resolve(top);
        }, duration);
      }),
    ms
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const checks: Record<string, (browser: Browser) => Promise<void>> = {
  "ENG-001: the engine line shows the rate, the latency and the state": async (
    browser
  ) => {
    const page = await open(browser);
    const line = await page.getByRole("region", { name: "Engine" }).innerText();
    assert(RATE.test(line) && LATENCY.test(line), `the line reads "${line}"`);
    assert(
      await page.evaluate(() => crossOriginIsolated),
      "the page is not cross-origin isolated"
    );
  },
  "ARR-006: audio files dropped on the add-track row make a track each, named after them":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, "[data-add-track]", "Chord take");
      await page.waitForSelector('[aria-label="Chord take"][data-track-id]', {
        timeout: 10_000,
      });
      await page.waitForSelector("[data-slot=timeline-clip-waveform]");
    },
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
  "EXP-001: export renders the main output to a 24-bit stereo WAV, to the end of the last clip":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, "[data-add-track]", "Chord take", 2);
      await page.waitForSelector('[aria-label="Chord take"][data-track-id]');
      const download = page.waitForEvent("download", { timeout: 30_000 });
      await page.getByRole("button", { name: EXPORT }).click();
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
  "MID-001: a note drawn in a MIDI clip plays through the track's instrument":
    async (browser) => {
      const page = await open(browser);
      const lane = await page.locator('[data-track="track-3"]').boundingBox();
      assert(lane, "the MIDI lane is there");
      await page.mouse.dblclick(lane.x + 30, lane.y + lane.height / 2);
      const grid = await page.waitForSelector("[data-slot=piano-roll-grid]", {
        timeout: 5000,
      });
      const box = await grid.boundingBox();
      assert(box, "the piano roll is open");
      await page.mouse.click(box.x + 20, box.y + box.height / 2);
      await showMixer(page);
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      // The clip loops a bar: its note comes round every two seconds.
      const level = await loudest(page, 2500);
      assert(
        level > -50,
        `the main track is near silent while the note plays (${level} dB)`
      );
      await page.keyboard.press("Space");
    },
  "PRJ-001: the project comes back when the page is loaded again": async (
    browser
  ) => {
    const page = await open(browser);
    await dropChord(page, "[data-add-track]", "Kept take", 1);
    await page.waitForSelector('[aria-label="Kept take"][data-track-id]');
    await page.waitForSelector("text=Saved", { timeout: 5000 });
    await open(browser, page);
    await page.waitForSelector('[aria-label="Kept take"][data-track-id]', {
      timeout: 10_000,
    });
    await page.waitForSelector("[data-slot=timeline-clip-waveform]", {
      timeout: 10_000,
    });
  },
};

const wanted = process.argv.slice(2);
const names = Object.keys(checks).filter(
  (name) => wanted.length === 0 || wanted.some((id) => name.startsWith(id))
);
const chrome = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
  executablePath: process.env.CHROME_PATH,
});
const failed = await names.reduce<Promise<number>>(async (count, name) => {
  const total = await count;
  try {
    await (checks[name] as (browser: Browser) => Promise<void>)(chrome);
    console.log(`  pass ${name}`);
    return total;
  } catch (error) {
    console.log(
      `  FAIL ${name}\n       ${error instanceof Error ? error.message : String(error)}`
    );
    return total + 1;
  }
}, Promise.resolve(0));
await chrome.close();
console.log(failed === 0 ? "\nAll checks pass." : `\n${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
