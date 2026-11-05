/**
 * The workstation in Chromium, driven with the mouse and the keyboard as a
 * person would: what docs/daw-spec asks of it end to end. Run the app first
 * (`bun run dev`), then `bun run test:browser`, or name checks:
 * `bun test/browser/run.ts ARR-006`. `DAW_URL` points at another server.
 *
 * Each check opens a fresh profile, so the project starts new, except where
 * a check reloads to see what was kept.
 */

import {
  type Browser,
  chromium,
  type Locator,
  type Page,
} from "playwright-core";
import { readZip } from "@/lib/zip";

const URL = process.env.DAW_URL ?? "http://localhost:3300/";
const RATE = /kHz/;
const LATENCY = /ms out/;
const EXPORT = /Export WAV/;
const DELAY = /Delay/;
const POCKET_SYNTH = /Pocket Synth/;
const UTILITY = /^Utility/;
const DEVICES = /^Devices/;
const UNITS = /\* ([\d.]+)\)/;
const MAIN_PEAK = /^Main peak/;

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

const FOLD = /^Fold /;
const REMOVE = /^Remove /;
const UNFOLD = /^Unfold /;

/** Drags across bare lanes, from near the start of one track to `across` px on under the pointer of another. */
async function selectTime(
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

/** Waits until a slider's value is no longer `before`. */
async function expectChanged(
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
async function showMixer(page: Page) {
  const level = page.locator('[aria-label="Main level"]');
  // Its key folds it when it is open, and a page loaded again comes back on it.
  if (await level.isHidden()) {
    await page.keyboard.press("Meta+Alt+KeyM");
  }
  await level.waitFor();
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

/** A drag and the arrows move a marker, each one step of undo, and neither moves the cursor; a press on it puts the cursor there. */
async function movesLikeAMarker(page: Page, marker: Locator) {
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
async function standsOnThePlayhead(page: Page, slot: string) {
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
  "ARR-006: audio files dropped on the add-track button make a track each, named after them":
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
      // Zoomed in, with no grid to snap to, 10 px from the start is a fraction of a second in.
      await page.keyboard.press("Meta+Equal");
      await page.keyboard.press("Meta+Equal");
      await page.keyboard.press("Meta+Digit4");
      await dropChord(page, "[data-add-track]", "Chord take", 2);
      await page.waitForSelector('[aria-label="Chord take"][data-track-id]');
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
  "MID-001: a note drawn in a MIDI clip plays through the track's instrument":
    async (browser) => {
      const page = await open(browser);
      const lane = await page.locator('[data-track="track-3"]').boundingBox();
      assert(lane, "the MIDI lane is there");
      // Near the start, in the first bar at any zoom.
      await page.mouse.dblclick(lane.x + 4, lane.y + lane.height / 2);
      const grid = await page.waitForSelector("[data-slot=piano-roll-grid]", {
        timeout: 5000,
      });
      const box = await grid.boundingBox();
      assert(box, "the piano roll is open");
      await page.mouse.click(box.x + 20, box.y + box.height / 2);
      await showMixer(page);
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      // The clip loops a bar: its note, a sixteenth, comes round every two seconds; listened to twice.
      const level = await loudest(page, 4500);
      assert(
        level > -50,
        `the main track is near silent while the note plays (${level} dB)`
      );
      await page.keyboard.press("Space");
    },
  "MID-007: the roll's keys are black and white, and a pressed one shows it":
    async (browser) => {
      const page = await open(browser);
      const lane = await page.locator('[data-track="track-3"]').boundingBox();
      assert(lane, "the MIDI lane is there");
      await page.mouse.dblclick(lane.x + 4, lane.y + lane.height / 2);
      await page.waitForSelector("[data-slot=piano-roll-keys]", {
        timeout: 5000,
      });
      const fill = (color: string) =>
        page
          .locator(`[data-slot=piano-roll-keys] [data-color=${color}]`)
          .nth(4);
      const background = (color: string) =>
        fill(color).evaluate((key) => getComputedStyle(key).backgroundColor);
      await page.waitForTimeout(200);
      const atRest = await background("black");
      assert(
        atRest !== (await background("white")),
        `black and white keys are both ${atRest}`
      );
      await fill("black").scrollIntoViewIfNeeded();
      const box = await fill("black").boundingBox();
      assert(box, "a black key is in view");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(200);
      const hovered = await background("black");
      await page.mouse.down();
      await page.waitForTimeout(300);
      const pressed = await background("black");
      await page.mouse.up();
      assert(
        pressed !== hovered && pressed !== atRest,
        `a pressed black key looks the same (${pressed}, hovered ${hovered})`
      );
    },
  "DEV-003: a device double-clicked in the library goes on the selected track":
    async (browser) => {
      const page = await open(browser);
      await page
        .locator('[aria-label="2 Audio"][data-track-id]')
        .getByText("2 Audio")
        .click();
      const library = page.getByRole("region", { name: "Library" });
      await library.getByRole("button", { name: "Space" }).click();
      await library.getByRole("option", { name: DELAY }).first().dblclick();
      const devices = page.getByRole("region", { name: "Devices" });
      // The panel's bar names the track whose devices it shows.
      await page
        .locator("[data-slot=panel-bar]")
        .getByText("2 Audio")
        .waitFor({ timeout: 5000 });
      await devices
        .getByText("Delay", { exact: true })
        .waitFor({ timeout: 5000 });
      // Folded, the device is no wider than its strip, whatever its panel's width.
      await devices.getByRole("button", { name: "Fold Delay" }).click();
      const slot = devices.locator(
        "[data-slot=device-chain-slot][data-folded]"
      );
      const width = (await slot.boundingBox())?.width ?? 0;
      assert(width < 48, `the folded device is ${width} px wide`);
    },
  "DEV-003: a device dropped on the add-track button makes a track for it":
    async (browser) => {
      const page = await open(browser);
      const before = await page.locator("[data-track-id]").count();
      const library = page.getByRole("region", { name: "Library" });
      await library
        .getByRole("option", { name: POCKET_SYNTH })
        .dragTo(page.locator("[data-add-track]"));
      await page.waitForSelector('[aria-label="Pocket Synth"][data-track-id]', {
        timeout: 5000,
      });
      const after = await page.locator("[data-track-id]").count();
      assert(after === before + 1, `${before} tracks, then ${after}`);
    },
  "KEY-021: Cmd+Option+B folds the library and shows it again": async (
    browser
  ) => {
    const page = await open(browser);
    await page.getByRole("region", { name: "Library" }).waitFor();
    await page.keyboard.press("Meta+Alt+KeyB");
    await page
      .getByRole("button", { exact: true, name: "Open the library" })
      .waitFor();
    await page.keyboard.press("Meta+Alt+KeyB");
    await page.getByRole("region", { name: "Library" }).waitFor();
  },
  "MIX-015: the mixer and the detail view take turns under the arrangement":
    async (browser) => {
      const page = await open(browser);
      await page.getByRole("region", { name: "Devices" }).waitFor();
      await showMixer(page);
      assert(
        (await page.getByRole("region", { name: "Devices" }).count()) === 0,
        "the detail view stays open beside the mixer"
      );
      await page.getByRole("tab", { name: DEVICES }).click();
      await page.getByRole("region", { name: "Devices" }).waitFor();
      assert(
        (await page.locator('[aria-label="Main level"]').count()) === 0,
        "the mixer stays open beside the detail view"
      );
    },
  "MIX-015: the line over the mixer or the detail view shares the height, and each keeps its own":
    async (browser) => {
      const page = await open(browser);
      const height = (name: string) =>
        page
          .getByRole("region", { exact: true, name })
          .evaluate((element) => element.getBoundingClientRect().height);
      const devices = await height("Devices");
      const line = page.locator("[data-slot=resizable-handle]");
      const box = await line.boundingBox();
      assert(box, "the line is there");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 6 });
      await page.mouse.up();
      const taller = await height("Devices");
      assert(
        Math.abs(taller - devices - 120) < 4,
        `dragged up 120 px, the detail view went from ${devices} to ${taller}`
      );
      await line.focus();
      await page.keyboard.press("ArrowDown");
      assert(
        (await height("Devices")) < taller,
        "Down on the line does not make the detail view shorter"
      );
      // The mixer opens at its own height, and the detail view comes back at the one it was given.
      const given = await height("Devices");
      await showMixer(page);
      await page.keyboard.press("Meta+Alt+KeyM");
      await page.getByRole("tab", { name: DEVICES }).click();
      const back = await height("Devices");
      assert(
        Math.abs(back - given) < 4,
        `the detail view came back at ${back}, not ${given}`
      );
    },
  "KEY-016 to KEY-018: the grid's keys and menu, the zoom's keys": async (
    browser
  ) => {
    const page = await open(browser);
    const grid = page.getByRole("button", { exact: true, name: "Grid" });
    const fitted = await grid.innerText();
    await page.keyboard.press("Meta+Digit1");
    const finer = await grid.innerText();
    assert(finer !== fitted, `Cmd+1 left the grid at ${fitted}`);
    await page.keyboard.press("Meta+Digit4");
    assert(
      (await grid.innerText()) === "Snap off",
      "Cmd+4 did not turn snapping off"
    );
    await page.keyboard.press("Meta+Digit4");
    await grid.click();
    await page.getByRole("menuitemradio", { name: "1 bar" }).click();
    assert(
      (await grid.innerText()) === "1 bar",
      "the menu did not fix the grid at a bar"
    );
    const unit = () =>
      page
        .locator("[data-track] ")
        .first()
        .evaluate((lane) => lane.getBoundingClientRect().width);
    const wide = await unit();
    await page.keyboard.press("Meta+Equal");
    await page.waitForTimeout(100);
    assert((await unit()) > wide * 1.9, "Cmd+= did not zoom in");
    await page.keyboard.press("KeyX");
    await page.waitForTimeout(100);
    assert(Math.abs((await unit()) - wide) < 2, "X did not go back to the fit");
  },
  "MIX-015: the panel folds to its strip, by its caret or by its line, and opens again":
    async (browser) => {
      const page = await open(browser);
      const devices = page.getByRole("region", {
        exact: true,
        name: "Devices",
      });
      await page.getByRole("button", { name: "Fold the panel" }).click();
      assert((await devices.count()) === 0, "folded, the devices still show");
      await page.getByRole("button", { name: "Open the panel" }).click();
      await devices.waitFor();
      // Dragged under the view's least height, the line folds it to its strip.
      const box = await page
        .locator("[data-slot=resizable-handle]")
        .boundingBox();
      assert(box, "the line is there");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 600, { steps: 8 });
      await page.mouse.up();
      await page.getByRole("button", { name: "Open the panel" }).waitFor();
      assert(
        (await devices.count()) === 0,
        "dragged down, the devices still show"
      );
    },
  "MIX-011: the main track holds its loudest peak until it is clicked": async (
    browser
  ) => {
    const page = await open(browser);
    await dropChord(page, "[data-add-track]", "Chord take");
    await page.waitForSelector('[aria-label="Chord take"][data-track-id]');
    await showMixer(page);
    const peak = page.getByRole("button", { name: MAIN_PEAK });
    assert((await peak.innerText()) === "-∞", "the peak starts at -∞");
    await page.keyboard.press("Home");
    await page.keyboard.press("Space");
    await page.waitForTimeout(1000);
    await page.keyboard.press("Space");
    const held = await peak.innerText();
    assert(held !== "-∞" && Number(held) > -40, `the peak held ${held}`);
    await peak.click();
    assert((await peak.innerText()) === "-∞", "a click did not clear the peak");
  },
  "ARR-010: a track moves by its grip, with Up and Down or dragged": async (
    browser
  ) => {
    const page = await open(browser);
    const order = () =>
      page
        .locator("[data-track-id]")
        .evaluateAll((rows) =>
          rows.map((row) => row.getAttribute("aria-label"))
        );
    await page.getByRole("button", { name: "Move 1 Audio" }).focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-track-id]")
          ?.getAttribute("aria-label") === "2 Audio"
    );
    const grip = await page
      .getByRole("button", { name: "Move 4 MIDI" })
      .boundingBox();
    // The first grip spans the first track's row.
    const top = await page
      .locator("[data-slot=track-grip]")
      .first()
      .boundingBox();
    assert(grip && top, "the grips are there");
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, top.y + 4, { steps: 10 });
    await page.waitForSelector("[data-slot=track-reorder-ghost]");
    await page.mouse.up();
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-track-id]")
          ?.getAttribute("aria-label") === "4 MIDI"
    );
    const names = await order();
    assert(
      names.at(-1) === "B Delay",
      `the returns stay last: ${names.join(", ")}`
    );
  },
  "ARR-011: a track's height is set by its edge, and it keeps it": async (
    browser
  ) => {
    const page = await open(browser);
    const row = page.locator(
      '[data-track-id="track-2"] [data-slot=timeline-track]'
    );
    const before = await row.boundingBox();
    const other = await page
      .locator('[data-track-id="track-3"] [data-slot=timeline-track]')
      .boundingBox();
    assert(before && other, "the rows are there");
    // The track shares the room until it is given a height of its own, by its edge.
    await page.getByLabel("2 Audio height").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
    const after = await row.boundingBox();
    assert(after, "the row is there");
    assert(
      after.height !== before.height,
      `the track stayed ${before.height} px tall`
    );
  },
  "ARR-012: a track folds to a strip, by its caret and with U": async (
    browser
  ) => {
    const page = await open(browser);
    const row = page.locator(
      '[data-track-id="track-2"] [data-slot=timeline-track]'
    );
    const tall = (await row.boundingBox())?.height ?? 0;
    await page.getByRole("button", { name: "Fold 2 Audio" }).click();
    await page.getByRole("button", { name: "Unfold 2 Audio" }).waitFor();
    const short = (await row.boundingBox())?.height ?? 0;
    assert(short < tall / 2, `folded, the track is ${short} px, from ${tall}`);
    await page.keyboard.press("Alt+KeyU");
    await page.getByRole("button", { name: "Fold 2 Audio" }).waitFor();
    await page.getByText("2 Audio", { exact: true }).first().click();
    await page.keyboard.press("KeyU");
    await page.getByRole("button", { name: "Unfold 2 Audio" }).waitFor();
  },
  "ARR-013: A shows the envelopes; a level moved by hand overrides one until it is enabled again":
    async (browser) => {
      const page = await open(browser);
      await page.keyboard.press("KeyA");
      await page.waitForSelector("[data-slot=automation-envelope]");
      // The first track's volume drawn: a point of its faint line moved with the keys.
      await page
        .locator('[data-track="track-1"] [aria-label^="Point 1"]')
        .first()
        .focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        () =>
          !document
            .querySelector(
              '[data-track="track-1"] [data-slot=automation-envelope]'
            )
            ?.className.includes("opacity-50")
      );
      assert(
        (await page
          .getByRole("button", { name: "Re-enable automation" })
          .count()) === 0,
        "nothing is overridden yet"
      );
      await page.getByRole("slider", { name: "1 Audio gain" }).focus();
      await page.keyboard.press("ArrowLeft");
      await page.getByRole("button", { name: "Re-enable automation" }).click();
      assert(
        (await page
          .getByRole("button", { name: "Re-enable automation" })
          .count()) === 0,
        "the automation was not enabled again"
      );
      await page.keyboard.press("KeyA");
      await page.waitForFunction(
        () => !document.querySelector("[data-slot=automation-envelope]")
      );
    },
  "AUT-001 and AUT-003: a track's chooser lists its devices' parameters, one is drawn, and a knob turned by hand overrides it":
    async (browser) => {
      const page = await open(browser);
      await page
        .locator('[aria-label="1 Audio"][data-track-id]')
        .getByText("1 Audio")
        .click();
      const library = page.getByRole("region", { name: "Library" });
      await library.getByLabel("Search the devices").fill("Utility");
      await library.getByRole("option", { name: UTILITY }).first().dblclick();
      const devices = page.getByRole("region", { name: "Devices" });
      await devices.getByText("Utility", { exact: true }).waitFor();
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("KeyA");
      await page.getByRole("combobox", { name: "1 Audio automation" }).click();
      await page.getByRole("option", { exact: true, name: "Gain" }).click();
      const lane = page.getByRole("group", {
        name: "1 Audio utility gain automation",
      });
      await lane.waitFor({ timeout: 5000 });
      // Drawn: a point of its faint line moved with the keys.
      await lane.locator('[aria-label^="Point 1"]').first().focus();
      await page.keyboard.press("ArrowUp");
      await page.waitForFunction(
        () =>
          !document
            .querySelector(
              '[data-track="track-1"] [data-slot=automation-envelope]'
            )
            ?.className.includes("opacity-50")
      );
      await devices.getByRole("slider", { name: "Gain" }).first().focus();
      await page.keyboard.press("ArrowRight");
      await page
        .getByRole("button", { name: "Re-enable automation" })
        .waitFor({ timeout: 5000 });
    },
  "AUT-006: playing, a track's gain and a device's knob move with their envelopes, untouched":
    async (browser) => {
      const page = await open(browser);
      await page
        .locator('[aria-label="1 Audio"][data-track-id]')
        .getByText("1 Audio")
        .click();
      const library = page.getByRole("region", { name: "Library" });
      await library.getByLabel("Search the devices").fill("Utility");
      await library.getByRole("option", { name: UTILITY }).first().dblclick();
      const devices = page.getByRole("region", { name: "Devices" });
      await devices.getByText("Utility", { exact: true }).waitFor();
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("KeyA");
      // A point moved far from the other end: the envelope is a ramp, whichever it draws.
      const ramp = async (name: string) => {
        await page
          .getByRole("group", { name })
          .locator('[aria-label^="Point 1"]')
          .first()
          .focus();
        await Array.from({ length: 30 }).reduce<Promise<void>>(
          (done) => done.then(() => page.keyboard.press("ArrowDown")),
          Promise.resolve()
        );
      };
      await ramp("1 Audio volume automation");
      const gain = page.getByRole("slider", { name: "1 Audio gain" });
      const fromGain = await gain.inputValue();
      await page.getByRole("combobox", { name: "1 Audio automation" }).click();
      await page.getByRole("option", { exact: true, name: "Gain" }).click();
      await ramp("1 Audio utility gain automation");
      const knob = devices.getByRole("slider", { name: "Gain" }).first();
      const fromKnob = await knob.inputValue();
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Space");
      await page.waitForFunction(
        ([before]) =>
          (
            document.querySelector(
              '[aria-label="1 Audio gain"]'
            ) as HTMLInputElement | null
          )?.value !== before,
        [fromGain],
        { timeout: 15_000 }
      );
      await expectChanged(knob, fromKnob);
      await page.keyboard.press("Space");
      assert(
        (await page
          .getByRole("button", { name: "Re-enable automation" })
          .count()) === 0,
        "the envelopes moved the controls, and nothing counts as moved by hand"
      );
      // Another knob turned by hand leaves the automated ones following their envelopes.
      await devices.getByRole("slider", { name: "Width" }).first().focus();
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(200);
      assert(
        (await page
          .getByRole("button", { name: "Re-enable automation" })
          .count()) === 0,
        "a knob with no envelope, turned, stopped the ones that have one"
      );
    },
  "AUT-006: playing, the mixer's fader and a rack's macro move with their envelopes":
    async (browser) => {
      const page = await open(browser);
      await page
        .locator('[aria-label="1 Audio"][data-track-id]')
        .getByText("1 Audio")
        .click();
      await page.getByRole("tab", { name: "Devices" }).click();
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Effect rack" }).click();
      const rack = page.locator("[data-slot=rack-panel]");
      await rack.getByRole("button", { exact: true, name: "Macros" }).click();
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("KeyA");
      // A point moved from the other end, by `key`: the envelope is a ramp.
      const ramp = async (name: string, key: string) => {
        await page
          .getByRole("group", { name })
          .locator('[aria-label^="Point 1"]')
          .first()
          .focus();
        await Array.from({ length: 30 }).reduce<Promise<void>>(
          (done) => done.then(() => page.keyboard.press(key)),
          Promise.resolve()
        );
      };
      await ramp("1 Audio volume automation", "ArrowDown");
      await page.getByRole("combobox", { name: "1 Audio automation" }).click();
      await page.getByRole("option", { exact: true, name: "Macro 1" }).click();
      await ramp("1 Audio rack macro 1 automation", "ArrowUp");
      const macro = rack.getByRole("slider", { name: "Macro 1" });
      const fromMacro = await macro.inputValue();
      assert(fromMacro !== "0", "the macro stands where its envelope starts");
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Space");
      await expectChanged(macro, fromMacro);
      await showMixer(page);
      const fader = page.getByRole("slider", { name: "1 Audio volume" });
      await expectChanged(fader, await fader.inputValue());
      await page.keyboard.press("Space");
    },
  "ARR-020: Cmd+J renders a track's clips into one new recording, which plays, and one undo brings them back":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 8);
      const clip = page
        .locator('[data-track="track-1"] [data-clip-id]')
        .first();
      await clip.waitFor({ timeout: 10_000 });
      const before = await clip.getAttribute("data-clip-id");
      await selectTime(page, "track-2", "track-1");
      await page.keyboard.press("Meta+KeyJ");
      // A new clip takes its place, whole, or the part of it the stretch covers.
      await page.waitForFunction(
        (id) =>
          document.querySelector(`[data-clip-id="${id}"]`) === null ||
          document.querySelectorAll('[data-track="track-1"] [data-clip-id]')
            .length > 1,
        before,
        { timeout: 20_000 }
      );
      await page.waitForSelector("text=Saved", { timeout: 5000 });
      await showMixer(page);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      const level = await loudest(page, 1500);
      await page.keyboard.press("Space");
      assert(level > -40, `the consolidated track plays at ${level} dB`);
      await page.keyboard.press("Meta+KeyZ");
      await page.waitForSelector(`[data-clip-id="${before}"]`, {
        timeout: 5000,
      });
    },
  "MIX-022: a track's header meters it: the track that plays reads a level, a thin pair, and the others none":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 8);
      await page.waitForSelector("[data-clip-id]", { timeout: 10_000 });
      const level = page.getByRole("group", { name: "1 Audio level" });
      const box = await level.boundingBox();
      assert(
        box && box.width < 12,
        `the header's meter is ${box?.width} px wide, not a thin pair`
      );
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      const read = (name: string) =>
        page.evaluate(
          ([label]) =>
            Number(
              document
                .querySelector(`[aria-label="${label}"] [aria-valuenow]`)
                ?.getAttribute("aria-valuenow")
            ),
          [name]
        );
      await page.waitForFunction(
        () =>
          Number(
            document
              .querySelector('[aria-label="1 Audio level"] [aria-valuenow]')
              ?.getAttribute("aria-valuenow")
          ) > -40,
        undefined,
        { timeout: 10_000 }
      );
      const other = await read("2 Audio level");
      await page.keyboard.press("Space");
      assert(!(other > -40), `the silent track reads ${other} dB`);
    },
  "CLP-006: a file dropped fades 4 ms at its edges, and Delete on a longer fade brings it back to 4 ms":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      await page.waitForSelector("[data-clip-id]", { timeout: 10_000 });
      const fade = page.getByRole("slider", { name: "Take fade in" });
      const value = () => fade.inputValue().then(Number);
      assert(
        Math.abs((await value()) - 0.004) < 1e-6,
        `a file dropped fades in over ${await value()} s`
      );
      await fade.focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        () =>
          Number(
            (
              document.querySelector(
                '[aria-label="Take fade in"]'
              ) as HTMLInputElement | null
            )?.value
          ) > 0.004
      );
      await page.keyboard.press("Delete");
      await page.waitForFunction(
        () =>
          Math.abs(
            Number(
              (
                document.querySelector(
                  '[aria-label="Take fade in"]'
                ) as HTMLInputElement | null
              )?.value
            ) - 0.004
          ) < 1e-6,
        undefined,
        { timeout: 5000 }
      );
      assert(
        (await page.locator("[data-clip-id]").count()) === 1,
        "Delete on a fade took the clip away too"
      );
    },
  "CLP-015: Warp in the clip panel keeps the pitch, in Beats, and the panel picks another mode; the clip still plays":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const modes = page.getByRole("group", { name: "Warp mode" });
      await modes.waitFor({ timeout: 5000 });
      const pressed = (name: string) =>
        modes
          .getByRole("button", { exact: true, name })
          .getAttribute("aria-pressed");
      assert(
        (await pressed("Repitch")) === "true",
        "a new clip starts in Repitch"
      );
      await page.getByRole("button", { exact: true, name: "Warp" }).click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Warp mode"]')
            ?.querySelectorAll('[aria-pressed="true"]')[0]?.textContent ===
          "Beats",
        undefined,
        { timeout: 5000 }
      );
      await modes.getByRole("button", { exact: true, name: "Tones" }).click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Warp mode"]')
            ?.querySelectorAll('[aria-pressed="true"]')[0]?.textContent ===
          "Tones",
        undefined,
        { timeout: 5000 }
      );
      await showMixer(page);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      const level = await loudest(page, 1500);
      await page.keyboard.press("Space");
      assert(level > -40, `the clip in Tones plays at ${level} dB`);
    },
  "REC-004: an armed audio track records a take from the cursor, which plays back as a clip; one undo takes it away":
    async (browser) => {
      const page = await open(browser);
      const clips = page.locator('[data-track="track-1"] [data-clip-id]');
      const before = await clips.count();
      await page.getByRole("button", { name: "Arm 1 Audio" }).click();
      assert(
        (await page
          .getByRole("button", { name: "Arm 1 Audio" })
          .getAttribute("aria-pressed")) === "true",
        "the track is armed"
      );
      await page.getByRole("button", { exact: true, name: "Record" }).click();
      // The take shows on its track as it records, and grows (REC-011).
      const live = page.locator(
        '[data-track="track-1"] [data-slot="arranged-take"]'
      );
      await live.waitFor({ timeout: 5000 });
      await page.waitForTimeout(1000);
      const first = await live.evaluate((element) => ({
        drawn: element.querySelector("path")?.getAttribute("d")?.length ?? 0,
        width: element.getBoundingClientRect().width,
      }));
      await page.waitForTimeout(1500);
      const later = await live.evaluate(
        (element) => element.getBoundingClientRect().width
      );
      assert(
        later > first.width && first.drawn > 0,
        `the take grows (${first.width} then ${later} px) and draws what comes in (${first.drawn})`
      );
      await page.getByRole("button", { exact: true, name: "Record" }).click();
      await page.waitForFunction(
        () => !document.querySelector('[data-slot="arranged-take"]'),
        undefined,
        { timeout: 5000 }
      );
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('[data-track="track-1"] [data-clip-id]')
            .length > count,
        before,
        { timeout: 15_000 }
      );
      await showMixer(page);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      const level = await loudest(page, 1500);
      await page.keyboard.press("Space");
      assert(level > -40, `the take plays back at ${level} dB`);
      await page.keyboard.press("Meta+z");
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('[data-track="track-1"] [data-clip-id]')
            .length === count,
        before,
        { timeout: 5000 }
      );
    },
  "REC-005: a count-in counts the transport back in negative bars before the take starts":
    async (browser) => {
      const page = await open(browser);
      await page.getByRole("button", { name: "Arm 1 Audio" }).click();
      await page.getByRole("button", { name: "Record settings" }).click();
      await page.getByRole("menuitemradio", { name: "1 bar" }).click();
      await page.keyboard.press("Escape");
      const spoken = page.locator('[data-slot="transport-position"] .sr-only');
      await page.getByRole("button", { exact: true, name: "Record" }).click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-slot="transport-position"] .sr-only')
            ?.textContent?.startsWith("Bar -1"),
        undefined,
        { timeout: 3000 }
      );
      // A bar at 120 BPM is 2 s: then the take runs from 1.1.1.
      await page.waitForFunction(
        () =>
          !document
            .querySelector('[data-slot="transport-position"] .sr-only')
            ?.textContent?.startsWith("Bar -"),
        undefined,
        { timeout: 5000 }
      );
      const after = await spoken.textContent();
      await page.getByRole("button", { exact: true, name: "Record" }).click();
      assert(after?.startsWith("Bar 1,"), `after the count-in: ${after}`);
    },
  "REC-002: the computer's keyboard plays notes on an armed MIDI track, and a take keeps them as a MIDI clip":
    async (browser) => {
      const page = await open(browser);
      const clips = page.locator('[data-track="track-3"] [data-clip-id]');
      const before = await clips.count();
      await page.getByRole("button", { name: "Arm 3 MIDI" }).click();
      await page.getByRole("button", { name: "Record settings" }).click();
      await page
        .getByRole("menuitemcheckbox", { name: "Computer keyboard" })
        .click();
      await page.keyboard.press("Escape");
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.getByRole("button", { exact: true, name: "Record" }).click();
      await page.waitForTimeout(500);
      // A, then D: C and E; S is solo otherwise, here a note too.
      await ["a", "d", "s"].reduce(async (done, key) => {
        await done;
        await page.keyboard.down(key);
        await page.waitForTimeout(250);
        await page.keyboard.up(key);
      }, Promise.resolve());
      await page.waitForTimeout(300);
      await page.getByRole("button", { exact: true, name: "Record" }).click();
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('[data-track="track-3"] [data-clip-id]')
            .length > count,
        before,
        { timeout: 5000 }
      );
      const soloed = await page
        .getByRole("button", { name: "Solo 3 MIDI" })
        .getAttribute("aria-pressed");
      assert(soloed !== "true", "S played a note, it did not solo the track");
      const notes = await clips
        .last()
        .locator('[data-slot="timeline-clip-notes"] > *')
        .count();
      assert(notes === 3, `the take keeps the 3 notes played (${notes})`);
    },
  "REC-003: with Monitor input on, an armed audio track plays its input through its strip, stopped; off, it is silent":
    async (browser) => {
      const page = await open(browser);
      await showMixer(page);
      await page.getByRole("button", { name: "Arm 1 Audio" }).click();
      const quiet = await loudest(page, 800);
      await page.getByRole("button", { name: "Record settings" }).click();
      await page
        .getByRole("menuitemcheckbox", { name: "Monitor input (headphones)" })
        .click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
      const heard = await loudest(page, 1000);
      await page.getByRole("button", { name: "Arm 1 Audio" }).click();
      // The meter falls back at its own pace.
      await page.waitForTimeout(2500);
      const after = await loudest(page, 800);
      assert(
        quiet < -60,
        `before Monitor, the input is not heard (${quiet} dB)`
      );
      assert(
        heard > -40,
        `with Monitor, the armed track plays its input (${heard} dB)`
      );
      assert(after < -60, `disarmed, it stops (${after} dB)`);
    },
  "ARR-014: a drag across bare lanes selects time, and the keys work on it":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 8);
      await page.waitForSelector("[data-clip-id]", { timeout: 10_000 });
      const clips = () => page.locator("[data-clip-id]").count();
      await selectTime(page, "track-2", "track-1");
      assert(
        (await page.locator("[data-slot=timeline-time-selection]").count()) ===
          2,
        "the time selected is not drawn on the two tracks it spans"
      );
      const before = await clips();
      await page.keyboard.press("Meta+KeyD");
      await page.waitForFunction(
        (count) => document.querySelectorAll("[data-clip-id]").length > count,
        before
      );
      await page.keyboard.press("Meta+KeyZ");
      await page.waitForFunction(
        (count) => document.querySelectorAll("[data-clip-id]").length === count,
        before
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector("[data-slot=timeline-time-selection]")
      );
    },
  "ARR-015: Shift and a drag across bare lane selects the clips it touches":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 8);
      const clip = await page.waitForSelector("[data-clip-id]", {
        timeout: 10_000,
      });
      const box = await clip.boundingBox();
      const lane = await page.locator('[data-track="track-2"]').boundingBox();
      assert(box && lane, "the clip and the lane are there");
      await page.keyboard.press("Escape");
      await page.keyboard.down("Shift");
      await page.mouse.move(lane.x + box.width + 6, lane.y + lane.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 2, box.y + box.height / 2, { steps: 6 });
      await page.waitForSelector("[data-slot=timeline-marquee]");
      await page.mouse.up();
      await page.keyboard.up("Shift");
      await page.waitForSelector("[data-clip-id][data-selected]", {
        timeout: 5000,
      });
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
  "ARR-016: M puts a locator at the cursor, and Alt with the arrows jumps to it":
    async (browser) => {
      const page = await open(browser);
      const at = () =>
        page
          .locator("[data-slot=timeline-playhead]")
          .first()
          .evaluate((element) =>
            Number(
              (element as HTMLElement).style.getPropertyValue(
                "--timeline-offset"
              )
            )
          );
      const lane = await page.locator('[data-track="track-2"]').boundingBox();
      assert(lane, "the lane is there");
      await page.mouse.click(lane.x + 200, lane.y + lane.height / 2);
      const placed = await at();
      assert(placed > 0, "a click in the lane did not move the cursor");
      await page.keyboard.press("KeyM");
      await page
        .getByRole("button", { name: "Locator 1" })
        .waitFor({ timeout: 5000 });
      await standsOnThePlayhead(page, "timeline-locator");
      await page.keyboard.press("Home");
      await page.waitForFunction(
        () =>
          Number(
            (
              document.querySelector(
                "[data-slot=timeline-playhead]"
              ) as HTMLElement
            ).style.getPropertyValue("--timeline-offset")
          ) === 0
      );
      await page.keyboard.press("Alt+ArrowRight");
      await page.waitForTimeout(100);
      assert(
        Math.abs((await at()) - placed) < 0.001,
        `Alt+Right went to ${await at()}, not to the locator at ${placed}`
      );
    },
  "ARR-017: a time signature goes at the cursor, opens to be typed, and the ruler counts through it":
    async (browser) => {
      const page = await open(browser);
      const lane = await page.locator('[data-track="track-2"]').boundingBox();
      assert(lane, "the lane is there");
      await page.mouse.click(lane.x + 200, lane.y + lane.height / 2);
      await page.getByRole("button", { name: "Add a marker" }).click();
      await page.getByRole("menuitem", { name: "Time signature" }).click();
      await page.waitForFunction(
        () => document.activeElement?.tagName === "INPUT"
      );
      await page.keyboard.press("ControlOrMeta+KeyA");
      await page.keyboard.type("7/8");
      await page.keyboard.press("Enter");
      await page
        .getByText("7/8", { exact: true })
        .first()
        .waitFor({ timeout: 5000 });
      await standsOnThePlayhead(page, "timeline-signature");
    },
  "ARR-016: a locator moves by a drag and the arrows, one step of undo each, and a press still jumps":
    async (browser) => {
      const page = await open(browser);
      const lane = await page.locator('[data-track="track-2"]').boundingBox();
      assert(lane, "the lane is there");
      await page.mouse.click(lane.x + 200, lane.y + lane.height / 2);
      await page.keyboard.press("KeyM");
      const locator = page.getByRole("button", { name: "Locator 1" });
      await locator.waitFor({ timeout: 5000 });
      await movesLikeAMarker(page, locator);
    },
  "ARR-016: a double-click on a locator plays from it, and Stop comes back to it":
    async (browser) => {
      const page = await open(browser);
      const offset = () =>
        page
          .locator("[data-slot=timeline-playhead]")
          .first()
          .evaluate((element) =>
            Number(
              (element as HTMLElement).style.getPropertyValue(
                "--timeline-offset"
              )
            )
          );
      const lane = await page.locator('[data-track="track-2"]').boundingBox();
      assert(lane, "the lane is there");
      await page.mouse.click(lane.x + 200, lane.y + lane.height / 2);
      const placed = await offset();
      await page.keyboard.press("KeyM");
      const locator = page.getByRole("button", { name: "Locator 1" });
      await locator.waitFor({ timeout: 5000 });
      await page.keyboard.press("Home");
      await locator.dblclick();
      await page.waitForTimeout(1200);
      const played = await offset();
      assert(
        played > placed + 0.5,
        `a second after the double-click the playhead is at ${played}, the locator at ${placed}`
      );
      assert(
        (await page.locator("[data-slot=timeline-locator-input]").count()) ===
          0,
        "the double-click opened the name to edit"
      );
      await page.keyboard.press("Space");
      await page.waitForTimeout(200);
      assert(
        Math.abs((await offset()) - placed) < 0.001,
        `Stop went to ${await offset()}, not back to the locator at ${placed}`
      );
    },
  "ARR-017: a time signature moves by a drag and the arrows, one step of undo each, and a press still jumps":
    async (browser) => {
      const page = await open(browser);
      const lane = await page.locator('[data-track="track-2"]').boundingBox();
      assert(lane, "the lane is there");
      await page.mouse.click(lane.x + 200, lane.y + lane.height / 2);
      await page.getByRole("button", { name: "Add a marker" }).click();
      await page.getByRole("menuitem", { name: "Time signature" }).click();
      await page.waitForFunction(
        () => document.activeElement?.tagName === "INPUT"
      );
      await page.keyboard.press("Enter");
      const signature = page.locator("[data-slot=timeline-signature]").last();
      await signature.waitFor({ timeout: 5000 });
      await movesLikeAMarker(page, signature);
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
  "ARR-018: the arrows move the cursor on the grid, End goes to the last clip, Up and Down pick a track":
    async (browser) => {
      const page = await open(browser);
      const at = () =>
        page
          .locator("[data-slot=timeline-playhead]")
          .first()
          .evaluate((element) =>
            Number(
              (element as HTMLElement).style.getPropertyValue(
                "--timeline-offset"
              )
            )
          );
      await dropChord(page, '[data-track="track-1"]', "Take", 8);
      await page.waitForSelector("[data-clip-id]", { timeout: 10_000 });
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(100);
      assert((await at()) > 0, "Right did not move the cursor");
      await page.keyboard.press("End");
      await page.waitForTimeout(100);
      assert((await at()) >= 8, `End went to ${await at()}`);
      await page
        .locator('[data-track="track-2"]')
        .click({ position: { x: 300, y: 10 } });
      await page
        .locator("[data-slot=panel-bar]")
        .getByText("2 Audio")
        .waitFor();
      await page.keyboard.press("ArrowDown");
      await page.locator("[data-slot=panel-bar]").getByText("3 MIDI").waitFor();
      await page.keyboard.press("ArrowUp");
      await page
        .locator("[data-slot=panel-bar]")
        .getByText("2 Audio")
        .waitFor();
    },
  "ARR-019: a clip moves to a track that takes it, and Option copies it":
    async (browser) => {
      const page = await open(browser);
      // Zoomed in, a clip of a bar has a title bar to hold.
      await page.keyboard.press("Meta+Equal");
      await page.keyboard.press("Meta+Equal");
      await page.waitForTimeout(150);
      const lane = await page.locator('[data-track="track-3"]').boundingBox();
      assert(lane, "the lane is there");
      await page.mouse.dblclick(lane.x + 4, lane.y + lane.height / 2);
      const head = page.locator(
        "[data-clip-id] [data-slot=timeline-clip-header]"
      );
      await head.waitFor({ timeout: 5000 });
      const trackOf = () =>
        page
          .locator("[data-clip-id]")
          .first()
          .evaluate((clip) =>
            clip.closest("[data-track]")?.getAttribute("data-track")
          );
      const dragTo = async (track: string, sideways = 0) => {
        const box = await head.first().boundingBox();
        const to = await page.locator(`[data-track="${track}"]`).boundingBox();
        assert(box && to, "the clip and the lane are there");
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width / 2 + sideways,
          to.y + to.height / 2,
          { steps: 8 }
        );
      };
      await dragTo("track-1");
      await page.mouse.up();
      await page.waitForTimeout(100);
      assert(
        (await trackOf()) === "track-3",
        "an audio track took a MIDI clip"
      );
      await dragTo("track-4");
      await page.mouse.up();
      await page.waitForFunction(() =>
        document.querySelector('[data-track="track-4"] [data-clip-id]')
      );
      await page.keyboard.down("Alt");
      const box = await head.first().boundingBox();
      assert(box, "the clip is there");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 1.8, box.y + box.height / 2, {
        steps: 8,
      });
      await page.waitForSelector("[data-slot=arranged-clip-ghost]");
      await page.mouse.up();
      await page.keyboard.up("Alt");
      await page.waitForFunction(
        () => document.querySelectorAll("[data-clip-id]").length === 2
      );
    },
  "KEY-012: Delete takes a track its header picked, not one a press on its lane did":
    async (browser) => {
      const page = await open(browser);
      const count = () => page.locator("[data-track]").count();
      const before = await count();
      await page
        .locator('[data-track="track-2"]')
        .click({ position: { x: 300, y: 10 } });
      await page.keyboard.press("Delete");
      await page.waitForTimeout(100);
      assert(
        (await count()) === before,
        "a press on a lane let Delete take its track"
      );
      await page.getByText("2 Audio", { exact: true }).first().click();
      await page.keyboard.press("Delete");
      await page.waitForFunction(
        (tracks) =>
          document.querySelectorAll("[data-track]").length === tracks - 1,
        before
      );
      await page.getByRole("button", { name: "Undo (Cmd Z)" }).click();
      await page.waitForFunction(
        (tracks) => document.querySelectorAll("[data-track]").length === tracks,
        before
      );
    },
  "the bar zooms, lists the keys, and a lane's menu sets the grid": async (
    browser
  ) => {
    const page = await open(browser);
    const wide = () =>
      page
        .locator('[data-track="track-1"]')
        .evaluate((lane) => lane.getBoundingClientRect().width);
    const fitted = await wide();
    await page.getByRole("button", { name: "More controls" }).click();
    await page.getByRole("menuitemradio", { name: "Zoom 400 %" }).click();
    await page.waitForFunction(
      (from) =>
        (
          document.querySelector('[data-track="track-1"]') as HTMLElement
        ).getBoundingClientRect().width >
        from * 3.9,
      fitted
    );
    // A preset leaves the menu open, to try another.
    await page.getByRole("menuitem", { name: "Keyboard shortcuts" }).click();
    await page
      .getByText("Add a locator at the cursor")
      .waitFor({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page
      .locator('[data-track="track-2"]')
      .click({ button: "right", position: { x: 300, y: 10 } });
    await page.getByRole("menuitemradio", { name: "1/4" }).click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { exact: true, name: "Grid" })
      .filter({ hasText: "1/4" })
      .waitFor({ timeout: 5000 });
  },
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
  "PRJ-006 and PRJ-007: Cmd+S saves a folder with its document and samples, and Cmd+O opens it again":
    async (browser) => {
      const context = await browser.newContext({
        viewport: { height: 1000, width: 1440 },
      });
      const shared = await context.newPage();
      // The system's folder picker cannot be driven: it gives a folder of the private storage, which works the same.
      await shared.addInitScript(() => {
        (
          window as unknown as {
            showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker = async () =>
          (
            await (
              await navigator.storage.getDirectory()
            ).getDirectoryHandle("picked", { create: true })
          ).getDirectoryHandle("Mirages", { create: true });
      });
      const page = await open(browser, shared);
      await dropChord(page, "[data-add-track]", "Kick take", 2);
      await page.waitForSelector('[aria-label="Kick take"][data-track-id]');
      const folder = () =>
        page.evaluate(async () => {
          const root = await (
            await (
              await navigator.storage.getDirectory()
            ).getDirectoryHandle("picked")
          ).getDirectoryHandle("Mirages");
          const document = JSON.parse(
            await (
              await (await root.getFileHandle("Mirages.audioui")).getFile()
            ).text()
          ) as { format: string; samples: { path: string }[]; version: number };
          const samples = await root.getDirectoryHandle("Samples");
          return {
            document,
            files: await Array.fromAsync(samples.keys()),
          };
        });
      await page.keyboard.press("Meta+KeyS");
      await page.getByText("Saved to Mirages").waitFor({ timeout: 10_000 });
      const first = await folder();
      assert(
        first.document.format === "audio-ui-daw" &&
          first.document.version === 1,
        `the document reads ${first.document.format} ${first.document.version}`
      );
      assert(
        first.files.join() === "Kick take.wav" &&
          first.document.samples[0]?.path === "Samples/Kick take.wav",
        `the folder holds ${first.files.join(", ")}`
      );
      await page.keyboard.press("Meta+KeyS");
      await page.waitForTimeout(1000);
      assert(
        (await folder()).files.length === 1,
        "a second save wrote the sample again"
      );
      await page.keyboard.press("Meta+KeyO");
      await page.getByText("Opened Mirages").waitFor({ timeout: 15_000 });
      await page.waitForSelector('[aria-label="Kick take"][data-track-id]');
      await showMixer(page);
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      const level = await loudest(page, 1500);
      await page.keyboard.press("Space");
      assert(level > -40, `the opened project plays at ${level} dB`);
    },
  "PRJ-008: a project goes out as a .dawproject file with its audio, and comes back in from it":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, "[data-add-track]", "Exported take", 2);
      await page.waitForSelector('[aria-label="Exported take"][data-track-id]');
      const download = page.waitForEvent("download", { timeout: 30_000 });
      await page.getByRole("button", { name: "More controls" }).click();
      await page.getByRole("menuitem", { name: "Export DAWproject…" }).click();
      const saved = await (await download).path();
      const entries = await readZip(Bun.file(saved));
      const project = new TextDecoder().decode(
        await entries.get("project.xml")?.read()
      );
      assert(
        project.includes('name="Exported take"') &&
          entries.has("audio/Exported take.wav"),
        `the archive holds ${[...entries.keys()].join(", ")}`
      );
      await page
        .locator('input[type="file"][accept=".dawproject"]')
        .setInputFiles({
          buffer: Buffer.from(await Bun.file(saved).arrayBuffer()),
          mimeType: "application/zip",
          name: "arrangement.dawproject",
        });
      await page
        .getByText("Opened arrangement.dawproject")
        .waitFor({ timeout: 15_000 });
      await page.waitForSelector('[aria-label="Exported take"][data-track-id]');
      await showMixer(page);
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      const level = await loudest(page, 1500);
      await page.keyboard.press("Space");
      assert(level > -40, `the imported project plays at ${level} dB`);
    },
  "MIX-020: Cmd+G groups the picked track, its sound plays through the group, and folding the group hides it":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Grouped take", 2);
      await page.getByText("1 Audio", { exact: true }).first().click();
      await page.keyboard.press("Meta+KeyG");
      await page.getByText("Group 1", { exact: true }).first().waitFor();
      const depth = await page
        .locator('[aria-label="1 Audio"][data-track-id] [data-depth]')
        .first()
        .getAttribute("data-depth");
      assert(depth === "1", `the grouped track sits at depth ${depth}`);
      assert(
        (await page
          .locator("[data-slot=arranged-group-preview] > div")
          .count()) === 1,
        "the group's lane does not show its track's clip"
      );
      await showMixer(page);
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      const level = await loudest(page, 1500);
      await page.keyboard.press("Space");
      assert(level > -40, `the grouped track plays at ${level} dB`);
      await page.getByRole("button", { name: "Fold Group 1" }).click();
      await page.waitForFunction(
        () => !document.querySelector('[aria-label="1 Audio"][data-track-id]')
      );
      await page.keyboard.press("Meta+Shift+KeyG");
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label="1 Audio"][data-track-id]') &&
          !document.querySelector('[aria-label="Group 1"][data-track-id]')
      );
    },
  "MIX-020: a track's menu groups it, a group's menu duplicates it with its tracks and lets them go":
    async (browser) => {
      const page = await open(browser);
      const menu = async (track: string, item: string) => {
        await page
          .getByText(track, { exact: true })
          .first()
          .click({ button: "right" });
        await page.getByRole("menuitem", { name: item, exact: true }).click();
      };
      await menu("1 Audio", "Group");
      await page.getByText("Group 1", { exact: true }).first().waitFor();
      await showMixer(page);
      await page
        .getByRole("region", { name: "1 Audio" })
        .getByText("To Group 1")
        .waitFor();
      await menu("Group 1", "Duplicate");
      await page.getByText("Group 1 copy", { exact: true }).first().waitFor();
      const inside = await page
        .locator('[data-track-id] [data-depth="1"]')
        .count();
      assert(inside === 2, `${inside} tracks sit in the two groups`);
      await menu("Group 1", "Ungroup");
      await page.waitForFunction(
        () =>
          !document.querySelector('[aria-label="Group 1"][data-track-id]') &&
          document.querySelector('[aria-label="Group 1 copy"][data-track-id]')
      );
    },
  "DEV-013: a drum rack on a MIDI track plays a pad when it is struck, and a voice picked on an empty pad makes one":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("3 MIDI", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      // The track has its synth: the strip that ends the chain adds racks.
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Drum rack" }).click();
      const drums = page.locator("[data-slot=drum-rack-panel]");
      await drums.waitFor({ timeout: 5000 });
      const pads = drums.getByRole("group", { name: "Pads" });
      await Promise.all(
        ["Kick C2", "Snare D2", "Hat F#2"].map((name) =>
          pads.getByLabel(name, { exact: true }).waitFor()
        )
      );
      // The kick rings four seconds: long enough to hear it on the main track's meter, in the mixer.
      await drums.getByRole("slider", { name: "Kick decay" }).focus();
      await page.keyboard.press("End");
      await pads.getByLabel("Kick C2", { exact: true }).click({ delay: 50 });
      await showMixer(page);
      const level = await loudest(page, 800);
      assert(level > -40, `the kick pad struck plays at ${level} dB`);
      await page.getByRole("tab", { name: "Devices" }).click();
      await pads.getByLabel("Empty C#2", { exact: true }).click();
      await drums
        .getByRole("group", { name: "Pad C#2" })
        .getByRole("button", { name: "Snare" })
        .click();
      await pads.getByLabel("Snare C#2", { exact: true }).waitFor();
    },
  "DEV-013: a recording dropped on a pad fills it, plays when the pad is struck, and comes back with the project":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("3 MIDI", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      // The track has its synth: the strip that ends the chain adds racks.
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Drum rack" }).click();
      const drums = page.locator("[data-slot=drum-rack-panel]");
      await drums.waitFor({ timeout: 5000 });
      await dropChord(
        page,
        '[data-slot=drum-rack-panel] [data-note="39"]',
        "Clap",
        1
      );
      const pads = drums.getByRole("group", { name: "Pads" });
      const clap = pads.getByLabel("Clap D#2", { exact: true });
      await clap.waitFor({ timeout: 5000 });
      await clap.click({ delay: 50 });
      await showMixer(page);
      const level = await loudest(page, 600);
      assert(level > -40, `the recording on the pad plays at ${level} dB`);
      await page.waitForSelector("text=Saved", { timeout: 5000 });
      await open(browser, page);
      await page.getByText("3 MIDI", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      await page
        .locator("[data-slot=drum-rack-panel]")
        .getByLabel("Clap D#2", { exact: true })
        .click({ delay: 50 });
      await showMixer(page);
      const again = await loudest(page, 600);
      assert(again > -40, `reloaded, the pad plays at ${again} dB`);
    },
  "DEV-008: an instrument's face has a chain's controls, and its pad plays the track's instrument":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("3 MIDI", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      const devices = page.getByRole("region", { name: "Devices" });
      await devices
        .getByRole("button", { name: "Fold Pocket Synth" })
        .waitFor({ timeout: 5000 });
      const pad = devices.locator("[data-slot=xypad]").first();
      const box = await pad.boundingBox();
      assert(box, "the Pocket Synth shows its pad");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      // A move plays: the pad calls out as its value changes.
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, {
        steps: 4,
      });
      // The pad keeps the note while the pointer holds it; the keys go to the page, to open the mixer.
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await showMixer(page);
      const level = await loudest(page, 600);
      await page.mouse.up();
      assert(level > -40, `the pad held plays the synth at ${level} dB`);
    },
  "DEV-014: an instrument rack takes an instrument at the head of a chain, and it plays the track's notes":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("4 MIDI", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Instrument rack" }).click();
      const rack = page.locator("[data-slot=rack-panel]");
      await rack.waitFor({ timeout: 5000 });
      const library = page.getByRole("region", { name: "Library" });
      await library.getByLabel("Search the devices").fill("Pocket Synth");
      await library
        .getByRole("option")
        .first()
        .dragTo(rack.locator("[data-slot=device-chain]"));
      const pad = rack.locator("[data-slot=xypad]").first();
      await pad.waitFor({ timeout: 5000 });
      const box = await pad.boundingBox();
      assert(box, "the synth in the rack shows its pad");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, {
        steps: 4,
      });
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await showMixer(page);
      const level = await loudest(page, 600);
      await page.mouse.up();
      assert(level > -40, `the synth in the rack plays at ${level} dB`);
    },
  "DEV-015: an instrument rack's Zones switch shows each chain's keys and velocities, and a key moved sets its zone":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("4 MIDI", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Instrument rack" }).click();
      const rack = page.locator("[data-slot=rack-panel]");
      await rack.waitFor({ timeout: 5000 });
      await rack.getByRole("button", { name: "Zones", exact: true }).click();
      const zones = rack.getByRole("list", { name: "Zones" });
      await zones.getByText("C-1 to G9").waitFor();
      // The lowest key up an octave, a key at a time.
      await zones.getByRole("slider").first().focus();
      await Array.from({ length: 12 }).reduce<Promise<void>>(
        (done) => done.then(() => page.keyboard.press("ArrowRight")),
        Promise.resolve()
      );
      await zones.getByText("C0 to G9").waitFor({ timeout: 5000 });
    },
  "DEV-010 and DEV-012: a rack takes a device from the library, plays it, and a macro turns its parameter":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Rack take", 3);
      await page.getByText("1 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Effect rack" }).click();
      const rack = page.locator("[data-slot=rack-panel]");
      await rack.waitFor({ timeout: 5000 });
      const library = page.getByRole("region", { name: "Library" });
      await library.getByLabel("Search the devices").fill("Utility");
      await library
        .getByRole("option", { name: UTILITY })
        .first()
        .dragTo(rack.locator("[data-slot=device-chain]"));
      await rack
        .getByText("Utility", { exact: true })
        .waitFor({ timeout: 5000 });
      await showMixer(page);
      const play = async () => {
        // The keys go to the page, not to the library's search field the drag left focused.
        await page.evaluate(() =>
          (document.activeElement as HTMLElement)?.blur()
        );
        await page.keyboard.press("Home");
        await page.keyboard.press("Space");
        const level = await loudest(page, 1500);
        await page.keyboard.press("Space");
        return level;
      };
      const through = await play();
      assert(through > -40, `the take through the rack plays at ${through} dB`);
      await page.getByRole("tab", { name: "Devices" }).click();
      // The macros start hidden: the title bar's switch shows them.
      await rack.getByRole("button", { name: "Macros", exact: true }).click();
      await rack.getByRole("button", { name: "Macro 1: 0 mapped" }).click();
      await page.getByRole("menuitem", { name: "Map a parameter" }).click();
      await page.getByRole("menuitem", { name: "Gain" }).click();
      await rack.getByRole("button", { name: "Macro 1: 1 mapped" }).waitFor();
      // The macro at 0 puts the gain at the bottom of its travel.
      await showMixer(page);
      const down = await play();
      assert(
        down < through - 20,
        `the macro mapped to the gain at 0 leaves the take at ${down} dB, from ${through} dB`
      );
    },
  "DEV-004: a device dragged: the others slide aside, it lands in the gap, Escape puts it back, and it goes into a rack":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("1 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      const library = page.getByRole("region", { name: "Library" });
      await ["Gate", "Limiter"].reduce(async (done, name) => {
        await done;
        await library.getByLabel("Search the devices").fill(name);
        await library.getByRole("option").first().dblclick();
      }, Promise.resolve());
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Effect rack" }).click();
      const outer = page.locator("[data-slot=device-chain]").first();
      const slots = outer.locator(":scope > [data-slot=device-chain-slot]");
      const order = () =>
        slots.evaluateAll((all) =>
          all.map((slot) => slot.getAttribute("aria-label")).join()
        );
      await page.locator("[data-slot=rack-panel]").waitFor({ timeout: 5000 });
      assert(
        (await order()) === "Gate,Limiter,Rack",
        `the chain reads ${await order()}`
      );
      const gate = await slots.nth(0).boundingBox();
      const limiter = await slots.nth(1).boundingBox();
      if (!(gate && limiter)) {
        throw new Error("the slots are not on the page");
      }
      const y = gate.y + 12;
      const pressAt = gate.x + 80;
      const ghost = page.locator("[data-slot=device-chain-ghost]");
      // A short press moves nothing.
      await page.mouse.move(pressAt, y);
      await page.mouse.down();
      await page.mouse.move(pressAt + 2, y);
      await page.mouse.up();
      assert((await ghost.count()) === 0, "a press of 2 px lifted the device");
      // Past the Limiter: it slides back by the Gate's width, and the copy follows.
      await page.mouse.move(pressAt, y);
      await page.mouse.down();
      await page.mouse.move(limiter.x + limiter.width - 10, y, { steps: 8 });
      await page.waitForTimeout(250);
      assert((await ghost.count()) === 1, "no label follows the pointer");
      const slid = await slots.nth(1).boundingBox();
      assert(
        !!slid && Math.abs(limiter.x - slid.x - gate.width) < 2,
        `the Limiter went from ${limiter.x} to ${slid?.x}`
      );
      // The label hides nothing; the device itself shows dimmed where it would land.
      const label = await ghost.boundingBox();
      assert(
        !!label && label.width < 200 && label.height < 40,
        `the label is ${label?.width} by ${label?.height}`
      );
      const dimmed = await slots.nth(0).boundingBox();
      assert(
        !!dimmed && Math.abs(dimmed.x - slid.x - slid.width) < 2,
        `the Gate shows at ${dimmed?.x}, not after the Limiter at ${slid.x}`
      );
      const opacity = await slots
        .nth(0)
        .evaluate((slot) => getComputedStyle(slot).opacity);
      assert(Number(opacity) < 0.5, `the Gate shows at ${opacity}`);
      // Escape puts it back.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);
      await page.mouse.up();
      assert(
        (await order()) === "Gate,Limiter,Rack",
        `after Escape the chain reads ${await order()}`
      );
      assert((await ghost.count()) === 0, "the copy stayed after Escape");
      // Dragged again and released, it lands in the gap: no frame shows the old order once the copy is gone.
      await page.mouse.move(pressAt, y);
      await page.mouse.down();
      await page.mouse.move(limiter.x + limiter.width - 10, y, { steps: 8 });
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        const frames: string[] = [];
        (window as unknown as { dropFrames: string[] }).dropFrames = frames;
        const read = () => {
          const chain = document.querySelector("[data-slot=device-chain]");
          const names = [
            ...(chain?.querySelectorAll(
              ":scope > [data-slot=device-chain-slot]"
            ) ?? []),
          ].map((slot) => slot.getAttribute("aria-label"));
          const lifted = document.querySelector(
            "[data-slot=device-chain-ghost]"
          );
          frames.push(`${lifted ? "lifted" : "landed"}:${names.join()}`);
          if (frames.length < 60) {
            requestAnimationFrame(read);
          }
        };
        requestAnimationFrame(read);
      });
      await page.mouse.up();
      await page.waitForTimeout(1100);
      const frames = await page.evaluate(
        () => (window as unknown as { dropFrames: string[] }).dropFrames
      );
      assert(
        !frames.includes("landed:Gate,Limiter,Rack"),
        `a frame shows the old order after the landing: ${frames.join(" | ").slice(0, 300)}`
      );
      assert(
        (await order()) === "Limiter,Gate,Rack",
        `after the drop the chain reads ${await order()}`
      );
      assert((await ghost.count()) === 0, "the copy stayed after the drop");
      // Into the rack's chain: it leaves the track's chain.
      const first = await slots.nth(0).boundingBox();
      const inner = await outer
        .locator("[data-slot=rack-panel] [data-slot=device-chain]")
        .boundingBox();
      if (!(first && inner)) {
        throw new Error("the rack's chain is not on the page");
      }
      await page.mouse.move(first.x + 80, first.y + 12);
      await page.mouse.down();
      // Anywhere over the rack is into it: from its list of chains, its chain lights up, with a line at its end.
      const rackBox = await outer
        .locator("[data-slot=rack-panel]")
        .boundingBox();
      if (!rackBox) {
        throw new Error("the rack is not on the page");
      }
      await page.mouse.move(rackBox.x + 60, rackBox.y + 120, { steps: 10 });
      await page.waitForTimeout(150);
      const lit = await outer
        .locator("[data-slot=rack-panel] [data-slot=device-chain]")
        .getAttribute("data-over");
      assert(lit === "", "over the rack, its chain does not light up");
      assert(
        (await outer.getAttribute("data-over")) === null,
        "the track's chain lights up too"
      );
      await page.mouse.move(inner.x + 20, inner.y + 60, { steps: 4 });
      await page.waitForTimeout(150);
      await page.mouse.up();
      await page.waitForTimeout(350);
      assert(
        (await order()) === "Gate,Rack",
        `after the drop into the rack the chain reads ${await order()}`
      );
      assert(
        (await page
          .locator("[data-slot=rack-panel] [data-slot=device-chain-slot]")
          .getAttribute("aria-label")) === "Limiter",
        "the Limiter is not in the rack"
      );
      // A second one, held past the Limiter: the line is after the last device of the rack.
      const gateNow = await slots.nth(0).boundingBox();
      const held = await outer
        .locator("[data-slot=rack-panel] [data-slot=device-chain-slot]")
        .boundingBox();
      if (!(gateNow && held)) {
        throw new Error("the slots are not on the page");
      }
      await page.mouse.move(gateNow.x + 80, gateNow.y + 12);
      await page.mouse.down();
      await page.mouse.move(held.x + held.width - 4, held.y + 60, {
        steps: 10,
      });
      await page.waitForTimeout(150);
      const atEnd = await page
        .locator("[data-slot=rack-panel] [data-drop-end]")
        .count();
      assert(atEnd === 1, "no line at the end of the rack's chain");
      await page.keyboard.press("Escape");
      await page.mouse.up();
    },
  "ARR-021: a sideways swipe at the end of a scroll does not reach the browser's back":
    async (browser) => {
      const page = await open(browser);
      const behavior = await page.evaluate(() =>
        [document.documentElement, document.body]
          .map((element) => getComputedStyle(element).overscrollBehaviorX)
          .join()
      );
      assert(behavior === "none,none", `the page overscrolls as ${behavior}`);
      const before = page.url();
      await page.mouse.move(800, 700);
      await page.mouse.wheel(-600, 0);
      await page.waitForTimeout(200);
      assert(page.url() === before, "the page went back");
    },
  "CLP-020: zoomed in, a clip's waveform is solid and no wider than the view, a column per pixel":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, "[data-add-track]", "Long take", 20);
      const canvas = page.locator("[data-slot=timeline-clip-waveform]").first();
      await canvas.waitFor({ timeout: 30_000 });
      await [1, 2, 3, 4, 5].reduce(async (done) => {
        await done;
        await page.keyboard.press("Meta+Equal");
        await page.waitForTimeout(60);
      }, Promise.resolve());
      await page.waitForTimeout(400);
      const read = await canvas.evaluate((element) => {
        const drawn = element as HTMLCanvasElement;
        const clip = drawn.parentElement?.getBoundingClientRect();
        const view = drawn
          .closest("[data-slot=timeline-viewport]")
          ?.getBoundingClientRect();
        const row = drawn
          .getContext("2d")
          ?.getImageData(0, drawn.height / 2, drawn.width, 1).data;
        let empty = 0;
        for (let column = 0; column < drawn.width; column += 1) {
          if (!row?.[column * 4 + 3]) {
            empty += 1;
          }
        }
        return {
          clip: clip?.width ?? 0,
          columns: drawn.width,
          empty,
          scale: window.devicePixelRatio,
          shown: drawn.getBoundingClientRect().width,
          view: view?.width ?? 0,
        };
      });
      assert(
        read.clip > read.shown,
        `a clip of ${read.clip} px draws ${read.shown} px`
      );
      assert(
        read.shown <= read.view + 1024,
        `${read.shown} px drawn in a view of ${read.view} px`
      );
      assert(
        Math.abs(read.columns - read.shown * read.scale) < 2,
        `${read.columns} columns over ${read.shown} px`
      );
      assert(
        read.empty === 0,
        `${read.empty} of ${read.columns} columns are gaps`
      );
    },
  "CLP-020: the clip view's waveform is solid too, a column per pixel": async (
    browser
  ) => {
    const page = await open(browser);
    await dropChord(page, '[data-track="track-1"]', "Take", 4);
    const clip = page.locator("[data-clip-id]").first();
    await clip.waitFor({ timeout: 10_000 });
    await clip.click();
    await page.getByRole("tab", { name: "Clip" }).click();
    const canvas = page.locator("[data-slot=clip-panel-source] canvas");
    await canvas.waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    const read = await canvas.evaluate((element) => {
      const drawn = element as HTMLCanvasElement;
      const row = drawn
        .getContext("2d")
        ?.getImageData(0, Math.floor(drawn.height / 2), drawn.width, 1).data;
      let empty = 0;
      for (let column = 0; column < drawn.width; column += 1) {
        if (!row?.[column * 4 + 3]) {
          empty += 1;
        }
      }
      return { columns: drawn.width, empty };
    });
    assert(read.columns > 0, "the waveform has no columns");
    assert(
      read.empty === 0,
      `${read.empty} of ${read.columns} columns are gaps`
    );
  },
  "CLP-020: the clip view's waveform follows a zoom as it goes, not once it stops":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 20);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const source = page.locator("[data-slot=clip-panel-source]");
      await source.locator("canvas").waitFor({ timeout: 5000 });
      await page.waitForTimeout(400);
      const box = await source.boundingBox();
      await page.mouse.move(
        (box?.x ?? 0) + (box?.width ?? 0) / 2,
        (box?.y ?? 0) + (box?.height ?? 0) / 2
      );
      const drawn = () =>
        source.locator("canvas").evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          return canvas.width > 0
            ? canvas.toDataURL()
            : `${canvas.width}x${canvas.height}`;
        });
      const before = await drawn();
      await page.keyboard.down("Control");
      await [1, 2, 3, 4, 5, 6, 7, 8].reduce(async (done) => {
        await done;
        await page.mouse.wheel(0, -120);
      }, Promise.resolve());
      // In the frame after the last step, with no time for anything to catch up.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          })
      );
      const zoomed = await drawn();
      await page.keyboard.up("Control");
      await page.waitForTimeout(500);
      const settled = await drawn();
      assert(zoomed !== before, "the zoom drew nothing");
      assert(zoomed === settled, "the waveform caught up only after the zoom");
    },
  "CLP-021: the clip view dims what the clip leaves out of its source": async (
    browser
  ) => {
    const page = await open(browser);
    await dropChord(page, '[data-track="track-1"]', "Take", 20);
    const clip = page.locator("[data-clip-id]").first();
    await clip.waitFor({ timeout: 10_000 });
    await clip.click();
    await page.getByRole("tab", { name: "Clip" }).click();
    const left = page.locator("[data-slot=clip-panel-unplayed]").first();
    await left.waitFor({ state: "attached", timeout: 5000 });
    const width = async () => (await left.boundingBox())?.width ?? 0;
    assert((await width()) === 0, "a clip playing it all still dims some");
    const handle = page.getByRole("slider", { name: "Clip start" });
    await handle.focus();
    await [1, 2, 3, 4, 5, 6].reduce(async (done) => {
      await done;
      await page.keyboard.press("Shift+ArrowRight");
    }, Promise.resolve());
    await page.waitForTimeout(100);
    assert((await width()) > 0, "the stretch before the start is not dimmed");
  },
  "CLP-022: a clip box folds from anywhere on its heading, and unfolds from anywhere on its strip":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const box = page.locator("[data-slot=clip-box]", { hasText: "Loop" });
      // Its title, not its caret: the press lands on the button stretched over the heading.
      const title = await box
        .getByRole("heading", { name: "Loop" })
        .boundingBox();
      await page.mouse.click(
        (title?.x ?? 0) + 4,
        (title?.y ?? 0) + (title?.height ?? 0) / 2
      );
      await page.getByRole("button", { name: "Unfold Loop" }).waitFor();
      const strip = await box.boundingBox();
      assert(strip && strip.width < 48, "the box did not fold to a strip");
      await page.mouse.click(
        (strip?.x ?? 0) + (strip?.width ?? 0) / 2,
        (strip?.y ?? 0) + (strip?.height ?? 0) - 8
      );
      await page.getByRole("button", { name: "Fold Loop" }).waitFor();
    },
  "ARR-024: a range drawn narrow keeps both handles apart, and either still drags its own edge":
    async (browser) => {
      const page = await open(browser);
      const range = page.locator("[data-slot=timeline-range]").first();
      const handles = range.locator("[data-slot=timeline-range-handle]");
      const box = async (at: number) => {
        const found = await handles.nth(at).boundingBox();
        assert(found, "the handle is there");
        return found as NonNullable<typeof found>;
      };
      const zoom = async (key: string) => {
        await [1, 2, 3, 4, 5].reduce(async (done) => {
          await done;
          await page.keyboard.press(key);
          await page.waitForTimeout(60);
        }, Promise.resolve());
      };
      // Zoomed in, the grid lets it down to a bar; zoomed back out, that is a sliver.
      await zoom("Meta+Equal");
      await page.getByRole("slider", { exact: true, name: "Loop" }).focus();
      await page.keyboard.press("Meta+ArrowDown");
      await page.keyboard.press("Meta+ArrowDown");
      await page.locator("[data-slot=timeline-viewport]").first().click({
        position: { x: 700, y: 300 },
      });
      await zoom("Meta+Minus");
      await page.waitForTimeout(200);
      const narrow = await range.boundingBox();
      assert((narrow?.width ?? 99) < 20, `the range is ${narrow?.width} px wide`);
      const [start, end] = [await box(0), await box(1)];
      assert(
        end.x - (start.x + start.width) >= 1,
        `the handles are ${end.x - (start.x + start.width)} px apart`
      );
      await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2);
      await page.mouse.down();
      await page.mouse.move(end.x + end.width / 2 + 60, end.y + end.height / 2, {
        steps: 4,
      });
      await page.mouse.up();
      const grown = await range.boundingBox();
      assert(
        (grown?.width ?? 0) > (narrow?.width ?? 0) + 30,
        `dragged 60 px, the range went from ${narrow?.width} to ${grown?.width} px`
      );
      assert(
        Math.abs((grown?.x ?? 0) - (narrow?.x ?? 0)) < 1,
        "the end handle moved the start"
      );
    },
  "ARR-023: zoomed all the way in, the overview's window keeps both handles, apart, inside the bar, and one dragged zooms out":
    async (browser) => {
      const page = await open(browser);
      const bar = page.locator("[data-slot=timeline-navigator]");
      const edges = async () => {
        const read = async (label: string) => {
          const box = await bar
            .locator(`.cursor-ew-resize:has([aria-label="${label}"])`)
            .boundingBox();
          if (!box) {
            throw new Error(`no handle: ${label}`);
          }
          return box;
        };
        return {
          end: await read("End of the visible range"),
          start: await read("Start of the visible range"),
        };
      };
      const inBar = async () => {
        const box = await bar.boundingBox();
        const { end, start } = await edges();
        assert(
          !!box &&
            start.x >= box.x &&
            end.x + end.width <= box.x + box.width &&
            end.x - (start.x + start.width) >= 12,
          `the handles read ${JSON.stringify({ box, end, start })}`
        );
        return { end, start };
      };
      await inBar();
      await [1, 2, 3, 4, 5, 6, 7, 8].reduce(async (done) => {
        await done;
        await page.keyboard.press("Meta+Equal");
        await page.waitForTimeout(60);
      }, Promise.resolve());
      await page.waitForTimeout(300);
      const viewport = page.locator("[data-slot=timeline-viewport]");
      const { end, start } = await inBar();
      const opacity = await bar
        .locator(".cursor-ew-resize")
        .evaluateAll((all) =>
          all.map((one) => getComputedStyle(one).opacity).join()
        );
      assert(opacity === "1,1", `the handles show at ${opacity}`);
      // Between them, the window scrolls.
      const y = start.y + start.height / 2;
      const middle = (start.x + start.width + end.x) / 2;
      const scrolled = () => viewport.evaluate((element) => element.scrollLeft);
      const from = await scrolled();
      await page.mouse.move(middle, y);
      await page.mouse.down();
      await page.mouse.move(middle + 300, y, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(150);
      assert(
        (await scrolled()) > from,
        "the window between them did not scroll"
      );
      // Scrolled to the end, both still show.
      await viewport.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      await page.waitForTimeout(200);
      await inBar();
      // An edge dragged in, far past its least width: the other edge stays, the window at its least, and the view stops with it.
      await viewport.evaluate((element) => {
        element.scrollLeft = 0;
      });
      await page.keyboard.press("Meta+Minus");
      await page.keyboard.press("Meta+Minus");
      await page.keyboard.press("Meta+Minus");
      await page.waitForTimeout(250);
      const drawnEdges = await inBar();
      await page.mouse.move(
        drawnEdges.end.x + drawnEdges.end.width / 2,
        drawnEdges.end.y + drawnEdges.end.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(drawnEdges.end.x - 400, y, { steps: 8 });
      await page.waitForTimeout(100);
      const closest = await viewport.evaluate((element) => element.scrollWidth);
      await page.mouse.move(drawnEdges.end.x - 600, y, { steps: 4 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      const stopped = await inBar();
      assert(
        Math.abs(stopped.start.x - drawnEdges.start.x) <= 1,
        `the end handle moved the start from ${drawnEdges.start.x} to ${stopped.start.x}`
      );
      assert(
        (await viewport.evaluate((element) => element.scrollWidth)) === closest,
        "the view went on zooming past the window's least width"
      );
      // The start handle dragged in: the end stays where it is, and nothing slides.
      await page.mouse.move(
        stopped.start.x + stopped.start.width / 2,
        stopped.start.y + stopped.start.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(stopped.start.x + 300, y, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(150);
      const held = await inBar();
      assert(
        Math.abs(held.end.x - stopped.end.x) <= 1,
        `the start handle moved the end from ${stopped.end.x} to ${held.end.x}`
      );
      // A handle dragged out zooms out, with no double-click: here the end's, the window against the start of the bar.
      const wide = () => viewport.evaluate((element) => element.scrollWidth);
      const before = await wide();
      await page.mouse.move(
        held.end.x + held.end.width / 2,
        held.end.y + held.end.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(held.end.x + held.end.width / 2 + 200, y, {
        steps: 6,
      });
      await page.mouse.up();
      await page.waitForTimeout(200);
      const after = await wide();
      assert(after < before, `zoomed out from ${before} px to ${after} px`);
      const out = await inBar();
      assert(
        Math.abs(out.end.x - (held.end.x + 200)) <= 2,
        `the end handle is at ${out.end.x}, the pointer at ${held.end.x + 200}`
      );
    },
  "MIX-002: a track's fader and its mixer channel are one fader: the same range and the same place, each moved by the other":
    async (browser) => {
      const page = await open(browser);
      await page.getByRole("tab", { name: "Mixer" }).click();
      const track = page.getByRole("slider", { name: "2 Audio gain" });
      const channel = page.getByRole("slider", { name: "2 Audio volume" });
      await channel.waitFor({ timeout: 5000 });
      const read = async () =>
        Promise.all(
          [track, channel].map((slider) =>
            slider.evaluate((input) => {
              const { max, min, value } = input as HTMLInputElement;
              return { max, min, value };
            })
          )
        );
      const same = async (when: string) => {
        const [a, b] = await read();
        assert(
          JSON.stringify(a) === JSON.stringify(b),
          `${when}: ${JSON.stringify(a)} and ${JSON.stringify(b)}`
        );
        return a?.value;
      };
      assert((await same("at first")) === "0", "they do not start at 0 dB");
      await track.focus();
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      const down = await same("moved on the track");
      assert(Number(down) < 0, `the track's fader reads ${down}`);
      await channel.focus();
      await page.keyboard.press("End");
      assert(
        (await same("moved on the channel")) === "6",
        "the channel's top is not the track's"
      );
    },
  "ARR-022: a track removed, the page loaded again: a new track takes an id of its own, and shows and goes alone":
    async (browser) => {
      const page = await open(browser);
      const rows = page.locator("[data-track-id]");
      const ids = () =>
        rows.evaluateAll((all) =>
          all.map((row) => row.getAttribute("data-track-id") ?? "")
        );
      await page
        .getByText("2 Audio", { exact: true })
        .first()
        .click({ button: "right" });
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page.waitForTimeout(800);
      await page.reload();
      await page.waitForSelector("[data-track-id]", { timeout: 30_000 });
      const before = await rows.count();
      await page.getByRole("button", { name: "Add track" }).click();
      await page.getByRole("menuitem", { name: "Audio track" }).click();
      await page.waitForFunction(
        (count) => document.querySelectorAll("[data-track-id]").length > count,
        before
      );
      const after = await ids();
      assert(
        new Set(after).size === after.length,
        `two tracks share an id: ${after.join()}`
      );
    },
  "PRJ-001: a device removed forgets it was folded, so a new one under its id opens":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("1 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      const library = page.getByRole("region", { name: "Library" });
      await library.getByLabel("Search the devices").fill("Gate");
      const gate = library.getByRole("option").first();
      await gate.dblclick();
      const slot = page.locator("[data-slot=device-chain-slot]").first();
      await slot.getByRole("button", { name: FOLD }).click();
      await slot.getByRole("button", { name: REMOVE }).click();
      await page.waitForTimeout(100);
      await gate.dblclick();
      await page.locator("[data-slot=device-chain-slot]").first().waitFor();
      assert(
        (await page.locator("[data-slot=device-chain-strip]").count()) === 0,
        "the new device opens folded"
      );
    },
  "ARR: a track dragged by its grip: the rows slide aside, and it lands in the gap":
    async (browser) => {
      const page = await open(browser);
      const rows = page.locator("[data-slot=track-grip]");
      const names = () =>
        rows.evaluateAll((all) =>
          all.map((grip) => grip.getAttribute("aria-label")).join()
        );
      const before = await names();
      const first = await rows.nth(0).boundingBox();
      const second = await rows.nth(1).boundingBox();
      if (!(first && second)) {
        throw new Error("the grips are not on the page");
      }
      await page.mouse.move(first.x + 3, first.y + first.height / 2);
      await page.mouse.down();
      await page.mouse.move(first.x + 3, second.y + second.height - 4, {
        steps: 8,
      });
      await page.waitForTimeout(250);
      const slid = await rows.nth(1).boundingBox();
      assert(
        !!slid && Math.abs(second.y - slid.y - first.height) < 2,
        `the second track went from ${second.y} to ${slid?.y}`
      );
      assert(
        (await page.locator("[data-slot=track-reorder-ghost]").count()) === 1,
        "no copy of the header follows the pointer"
      );
      await page.mouse.up();
      await page.waitForTimeout(350);
      const [one, two, ...rest] = before.split(",");
      assert(
        (await names()) === [two, one, ...rest].join(),
        `from ${before} the tracks read ${await names()}`
      );
    },
  "DEV-004: a device held from the library over a rack lights its chain, not the track's":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("1 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Effect rack" }).click();
      const rack = page.locator("[data-slot=rack-panel]");
      await rack.waitFor({ timeout: 5000 });
      const library = page.getByRole("region", { name: "Library" });
      await library.getByLabel("Search the devices").fill("Gate");
      await library.getByRole("option").first().hover();
      await page.mouse.down();
      const box = await rack.boundingBox();
      if (!box) {
        throw new Error("the rack is not on the page");
      }
      // A native drag takes a first move to start, and shows over what the next ones reach.
      await page.mouse.move(box.x + 60, box.y + 120, { steps: 6 });
      await page.mouse.move(box.x + 64, box.y + 124, { steps: 3 });
      await page.waitForTimeout(150);
      const lit = await page.evaluate(() =>
        [...document.querySelectorAll("[data-slot=device-chain]")].map(
          (chain) => chain.getAttribute("data-over") !== null
        )
      );
      await page.mouse.up();
      assert(
        JSON.stringify(lit) === "[false,true]",
        `the chains lit are ${JSON.stringify(lit)}`
      );
      await rack
        .locator("[data-slot=device-chain-slot]")
        .first()
        .waitFor({ timeout: 5000 });
    },
  "DEV-006: a device's on square keeps its place and its shape when it folds":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("1 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      const library = page.getByRole("region", { name: "Library" });
      await library.getByLabel("Search the devices").fill("Limiter");
      await library.getByRole("option").first().dblclick();
      const slot = page.locator("[data-slot=device-chain-slot]").first();
      await slot.waitFor({ timeout: 5000 });
      const square = slot.locator("button[aria-pressed]").first();
      const read = async () => ({
        box: await square.boundingBox(),
        radius: await square.evaluate(
          (el) => getComputedStyle(el).borderRadius
        ),
      });
      const unfolded = await read();
      await slot.getByRole("button", { name: FOLD }).click();
      await slot.locator("[data-slot=device-chain-strip]").waitFor();
      const folded = await read();
      assert(
        JSON.stringify(folded) === JSON.stringify(unfolded),
        `the square goes from ${JSON.stringify(unfolded)} to ${JSON.stringify(folded)}`
      );
      // A press anywhere on the strip unfolds it, once it has not moved; its buttons keep their own job.
      const strip = slot.locator("[data-slot=device-chain-strip]");
      const box = await strip.boundingBox();
      if (!box) {
        throw new Error("the strip is not on the page");
      }
      const middle = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      };
      await page.mouse.move(middle.x, middle.y);
      await page.mouse.down();
      await page.mouse.move(middle.x + 30, middle.y, { steps: 4 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(100);
      assert(
        (await strip.count()) === 1,
        "a drag of the strip unfolded the device"
      );
      await square.click();
      await page.waitForTimeout(100);
      assert(
        (await strip.count()) === 1,
        "the on square of the strip unfolded the device"
      );
      // The strip is what is pressed: its arrow says so without a button's surface of its own.
      const arrow = slot.getByRole("button", { name: UNFOLD });
      await arrow.hover();
      await page.waitForTimeout(250);
      const surface = await arrow.evaluate(
        (el) => getComputedStyle(el).backgroundColor
      );
      assert(
        surface === "rgba(0, 0, 0, 0)",
        `the strip's arrow has a surface of its own (${surface})`
      );
      await arrow.focus();
      await page.keyboard.press("Enter");
      await slot
        .locator("[data-slot=device-header]")
        .waitFor({ timeout: 2000 });
      await slot.getByRole("button", { name: FOLD }).click();
      await strip.waitFor();
      // Its tools are always there, at the bottom in the title bar's order, with the name over them.
      await page.mouse.move(0, 0);
      const name = await strip.locator("span[title]").boundingBox();
      const tools = await Promise.all(
        [
          strip.locator("[data-device-grip]"),
          slot.getByRole("button", { name: REMOVE }),
          arrow,
        ].map((tool) => tool.boundingBox())
      );
      const [grip, remove, last] = tools;
      assert(
        !!name &&
          !!grip &&
          !!remove &&
          !!last &&
          name.y + name.height <= grip.y &&
          grip.y < remove.y &&
          remove.y < last.y &&
          box.y + box.height - (last.y + last.height) <= 6,
        `the strip's bottom reads ${JSON.stringify({ name, tools })}`
      );
      const opacity = await arrow.evaluate(
        (el) => getComputedStyle(el).opacity
      );
      assert(opacity === "1", `the arrow at rest is at ${opacity}`);
      await page.mouse.click(middle.x, middle.y);
      await slot
        .locator("[data-slot=device-header]")
        .waitFor({ timeout: 2000 });
    },
  "DEV-010: a rack's chain has no scroll of its own, and the strip that ends the track's chain stays at the right":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("1 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Effect rack" }).click();
      const rack = page.locator("[data-slot=rack-panel]");
      await rack.waitFor({ timeout: 5000 });
      const inside = rack.locator("[data-slot=device-chain]");
      const library = page.getByRole("region", { name: "Library" });
      const names = ["Compressor", "Limiter", "Phaser", "Gate"];
      await names.reduce(async (done, name, index) => {
        await done;
        await library.getByLabel("Search the devices").fill(name);
        await library.getByRole("option").first().dragTo(inside);
        await inside
          .locator(":scope > [data-slot=device-chain-slot]")
          .nth(index)
          .waitFor({ timeout: 5000 });
      }, Promise.resolve());
      const overflow = await inside.evaluate(
        (chain) => getComputedStyle(chain).overflowX
      );
      assert(
        overflow === "visible",
        `the rack's chain scrolls on its own (${overflow})`
      );
      const outer = page.locator("[data-slot=device-chain]").first();
      const scrollLeft = () => outer.evaluate((chain) => chain.scrollLeft);
      // Over a device of the rack, the wheel moves the track's chain.
      await outer.evaluate((chain) => {
        chain.scrollLeft = 400;
      });
      const view = await outer.boundingBox();
      if (!view) {
        throw new Error("the track's chain is not on the page");
      }
      await page.mouse.move(view.x + view.width / 2, view.y + 60);
      await page.mouse.wheel(200, 0);
      await page.waitForTimeout(300);
      const moved = await scrollLeft();
      assert(
        moved > 400,
        `the wheel over the rack leaves the track's chain at ${moved}`
      );
      // The strip stays at the view's right edge wherever the chain has scrolled.
      const strip = page.getByRole("button", { name: "Open the library" });
      const stripEnd = async () => {
        const box = await strip.boundingBox();
        return box ? box.x + box.width : 0;
      };
      const right = view.x + view.width;
      const scrolled = await stripEnd();
      assert(
        scrolled <= right && scrolled > right - 40,
        `the strip ends at ${scrolled}, the view at ${right}`
      );
      await outer.evaluate((chain) => {
        chain.scrollLeft = 0;
      });
      await page.waitForTimeout(100);
      const atStart = await stripEnd();
      assert(
        atStart <= right && atStart > right - 40,
        `at the start of the chain the strip ends at ${atStart}, the view at ${right}`
      );
    },
  "PRJ-001: how the workstation was laid out comes back when the page is loaded again":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("1 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      const library = page.getByRole("region", { name: "Library" });
      await library.getByRole("button", { name: "Space" }).click();
      await library.getByRole("option", { name: DELAY }).first().dblclick();
      const slot = page.locator("[data-slot=device-chain-slot]").first();
      await slot.getByRole("button", { name: FOLD }).click();
      await slot.locator("[data-slot=device-chain-strip]").waitFor();
      // A track folded, the mixer's view shown, zoomed in and scrolled, the metronome on.
      await page
        .locator('[aria-label="2 Audio"][data-track-id]')
        .getByRole("button", { name: FOLD })
        .click();
      await page.getByRole("button", { name: "Zoom in" }).click();
      await page.getByRole("button", { name: "Zoom in" }).click();
      const viewport = page.locator("[data-slot=timeline-viewport]");
      await viewport.evaluate((element) => {
        element.scrollLeft = 300;
      });
      await page
        .getByRole("button", { exact: true, name: "Metronome" })
        .click();
      await page.waitForTimeout(400);
      const read = async () => ({
        chosen: await library
          .getByRole("button", { name: "Space" })
          .getAttribute("aria-pressed"),
        folded: await page.locator("[data-slot=device-chain-strip]").count(),
        metronome: await page
          .getByRole("button", { exact: true, name: "Metronome" })
          .getAttribute("aria-pressed"),
        scroll: await viewport.evaluate((element) => element.scrollLeft),
        track: await page
          .locator('[aria-label="2 Audio"][data-track-id]')
          .getByRole("button", { name: UNFOLD })
          .count(),
      });
      const before = await read();
      assert(
        before.scroll === 300,
        `the arrangement did not scroll: ${before.scroll}`
      );
      await page.reload();
      await page.waitForSelector("[data-track-id]", { timeout: 30_000 });
      await page.waitForTimeout(500);
      const after = await read();
      assert(
        JSON.stringify(after) === JSON.stringify(before),
        `before ${JSON.stringify(before)}, after ${JSON.stringify(after)}`
      );
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
  // A fake microphone, a tone, granted without asking: what a take records (REC).
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
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
  } finally {
    // A check leaves its pages open: closed here, so one app at a time plays, not every check's at once.
    await Promise.all(chrome.contexts().map((context) => context.close()));
  }
}, Promise.resolve(0));
await chrome.close();
console.log(failed === 0 ? "\nAll checks pass." : `\n${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
