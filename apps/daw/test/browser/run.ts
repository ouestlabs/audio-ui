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
    },
  "DEV-003: a device dropped on the add-track row makes a track for it": async (
    browser
  ) => {
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
      await page
        .getByRole("button", { name: "Add a time signature at the cursor" })
        .click();
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
      await page
        .getByRole("button", { name: "Add a time signature at the cursor" })
        .click();
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
      await page.getByRole("button", { name: "Add a drum rack" }).click();
      const drums = page.locator("[data-slot=drum-rack-panel]");
      await drums.waitFor({ timeout: 5000 });
      const pads = drums.getByRole("group", { name: "Pads" });
      for (const name of ["Kick C2", "Snare D2", "Hat F#2"]) {
        await pads.getByLabel(name, { exact: true }).waitFor();
      }
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
  "DEV-010 and DEV-012: a rack takes a device from the library, plays it, and a macro turns its parameter":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Rack take", 3);
      await page.getByText("1 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      await page.getByRole("button", { name: "Add a rack" }).click();
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
