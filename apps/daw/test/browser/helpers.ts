/** What the checks share: opening the workstation on the test project, and finding, dragging and hearing its parts. */
import type { Browser, Locator, Page } from "playwright-core";

/** One check per entry, named by its id in docs/daw-spec. */
export type Checks = Record<string, (browser: Browser) => Promise<void>>;

export const URL = process.env.DAW_URL ?? "http://localhost:3300/";

/**
 * The project every check starts on, frozen so the demo song can change: a
 * new project's two MIDI tracks, two audio tracks and two returns (ARR-009),
 * as `writeProjectFile(newProject(), [])` wrote it on 2026-11-09.
 */
const FIXTURE = await Bun.file(`${import.meta.dir}/fixture.audioui`).text();
export const RATE = /kHz/;
export const LATENCY = /ms out/;
export const EXPORT = /^Export…/;
export const DELAY = /Delay/;
export const POCKET_SYNTH = /Pocket Synth/;
export const UTILITY = /^Utility/;
export const DEVICES = /^Devices/;
export const UNITS = /\* ([\d.]+)\)/;
export const MAIN_PEAK = /^Main peak/;
export const MAIN_LOUDNESS = /^Main loudness/;

/** A WAV file of `seconds` of a chord, made in the page and dropped on `selector`. */
export async function dropChord(
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

/** Drops files of the given bytes on `selector` at once, as a drag from the desktop would. */
export async function dropFiles(
  page: Page,
  selector: string,
  files: { bytes: Uint8Array; name: string; type: string }[]
) {
  await page.evaluate(
    ({ files: dropped, selector: target }) => {
      const transfer = new DataTransfer();
      for (const file of dropped) {
        const bytes = Uint8Array.from(atob(file.base64), (char) =>
          char.charCodeAt(0)
        );
        transfer.items.add(new File([bytes], file.name, { type: file.type }));
      }
      const element = document.querySelector(target) as HTMLElement;
      const box = element.getBoundingClientRect();
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
    {
      files: files.map((file) => ({
        base64: Buffer.from(file.bytes).toString("base64"),
        name: file.name,
        type: file.type,
      })),
      selector,
    }
  );
}

export const FOLD = /^Fold /;
export const REMOVE = /^Remove /;
export const UNFOLD = /^Unfold /;

/** Drags across bare lanes, from near the start of one track to `across` px on under the pointer of another. */
export async function selectTime(
  page: Page,
  fromTrack: string,
  toTrack: string,
  across = 60
) {
  const from = await page.locator(`[data-track="${fromTrack}"]`).boundingBox();
  const to = await page.locator(`[data-track="${toTrack}"]`).boundingBox();
  assert(from && to, "the lanes are there");
  await page.mouse.move(from.x + 3, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + across, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForSelector("[data-slot=timeline-time-selection]");
}

/**
 * Opens the workstation on the test project, its settings set to `settings`
 * first: dropped files play as recorded unless a check asks otherwise, so a
 * held chord laid down keeps its length (CLP-019).
 */
export async function open(
  browser: Browser,
  shared?: Page,
  settings: Record<string, unknown> = { warpOnImport: false }
) {
  const page =
    shared ??
    (await (
      await browser.newContext({
        acceptDownloads: true,
        viewport: { height: 1000, width: 1440 },
      })
    ).newPage());
  await page.addInitScript((kept) => {
    const key = "audio-ui-daw:settings";
    localStorage.setItem(
      key,
      JSON.stringify({
        ...JSON.parse(localStorage.getItem(key) ?? "{}"),
        ...kept,
      })
    );
  }, settings);
  // The test project in place of the song a first visit opens.
  await page.route("**/demo/hero.audioui", (route) =>
    route.fulfill({ body: FIXTURE, contentType: "application/json" })
  );
  await page.goto(URL);
  await page.waitForSelector("[data-track-id]", { timeout: 30_000 });
  return page;
}

/** Waits until a slider's value is no longer `before`. */
export async function expectChanged(
  slider: ReturnType<Page["getByRole"]>,
  before: string
) {
  await slider.evaluate(
    (element, from) =>
      new Promise<void>((resolve, reject) => {
        const end = performance.now() + 15_000;
        const look = () => {
          if ((element as HTMLInputElement).value !== from) {
            resolve();
          } else if (performance.now() > end) {
            reject(new Error(`the slider stayed at ${from}`));
          } else {
            requestAnimationFrame(look);
          }
        };
        look();
      }),
    before
  );
}

/** Opens the mixer, where the main track's meter is. */
export const PAN_KNOB = / pan$/;
export const SEND_KNOB = / send to /;

/** A knob turns by a drag up and not by one across (MIX-023). */
export async function dragKnobVertically(
  page: Page,
  knob: Locator,
  name: string
) {
  await knob.scrollIntoViewIfNeeded();
  const read = () =>
    knob.evaluate((input) => (input as HTMLInputElement).value);
  const box = await knob.evaluate((input) => {
    let node: HTMLElement | null = input as HTMLElement;
    while (node && node.getBoundingClientRect().width < 20) {
      node = node.parentElement;
    }
    const rect = node?.getBoundingClientRect();
    return rect && { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  assert(box, `${name} is there`);
  const before = await read();
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y, { steps: 5 });
  await page.mouse.up();
  assert((await read()) === before, `${name} moved by a drag across`);
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x, box.y - 30, { steps: 5 });
  await page.mouse.up();
  const after = await read();
  assert(
    Number(after) > Number(before),
    `${name} did not rise by a drag up, from ${before} to ${after}`
  );
}

export async function showMixer(page: Page) {
  // The mixer itself: the main track's row in the arrangement has a level of its own.
  const mixer = page.getByRole("group", { exact: true, name: "Mixer" });
  // Its key folds it when it is open, and a page loaded again comes back on it.
  if (await mixer.isHidden()) {
    await page.keyboard.press("Meta+Alt+KeyM");
  }
  await mixer.waitFor();
}

/** The loudest the main track's meter reads, in dB, over `ms` of playback. */
export function loudest(page: Page, ms: number) {
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

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/** A drag and the arrows move a marker, each one step of undo, and neither moves the cursor; a press on it puts the cursor there. */
export async function movesLikeAMarker(page: Page, marker: Locator) {
  const offset = (element: Locator) =>
    element.evaluate((node) =>
      Number(
        (
          node.closest(
            "[data-slot=timeline-mark],[data-slot=timeline-playhead]"
          ) as HTMLElement
        ).style.getPropertyValue("--timeline-offset")
      )
    );
  const cursor = page.locator("[data-slot=timeline-playhead]").first();
  const start = await offset(marker);
  const placed = await offset(cursor);
  const box = await marker.boundingBox();
  assert(box, "the marker is there");
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 208, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const dragged = await offset(marker);
  assert(
    dragged > start,
    `a drag left the marker at ${dragged}, from ${start}`
  );
  assert(
    (await offset(cursor)) === placed,
    "a drag of a marker moved the cursor"
  );
  await page.keyboard.press("ControlOrMeta+KeyZ");
  await page.waitForTimeout(100);
  assert(
    (await offset(marker)) === start,
    `undo left the marker at ${await offset(marker)}, not ${start}`
  );
  await marker.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  const stepped = await offset(marker);
  assert(stepped > start, `Right left the marker at ${stepped}`);
  assert(
    await marker.evaluate((node) => node === document.activeElement),
    "the marker lost the focus as it moved"
  );
  assert(
    (await offset(cursor)) === placed,
    "the arrows on a marker moved the cursor"
  );
  await page.keyboard.press("Home");
  await page.waitForTimeout(100);
  await marker.click();
  await page.waitForTimeout(100);
  assert(
    Math.abs((await offset(cursor)) - stepped) < 0.001,
    "a press on a marker did not put the cursor there"
  );
}

/** The line of a marker just put at the cursor falls on the playhead, not beside it. */
export async function standsOnThePlayhead(page: Page, slot: string) {
  const [line, playhead] = await Promise.all(
    [slot, "timeline-playhead"].map((name) =>
      page
        .locator(`[data-slot=${name}]`)
        .first()
        .evaluate((element) => element.getBoundingClientRect().left)
    )
  );
  assert(
    Math.abs((line ?? 0) - (playhead ?? 0)) < 1,
    `${slot} stands at ${line}, the playhead at ${playhead}`
  );
}
