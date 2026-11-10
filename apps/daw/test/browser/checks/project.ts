/** The checks of docs/daw-spec/project.md. */
import { readZip } from "@/lib/zip";
import {
  assert,
  type Checks,
  DELAY,
  dropChord,
  FOLD,
  loudest,
  open,
  REMOVE,
  showMixer,
  UNFOLD,
} from "../helpers";

export const checks: Checks = {
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
  "PRJ-001: a device removed forgets it was folded, so a new one under its id opens":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("3 Audio", { exact: true }).first().click();
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
  "PRJ-001: how the workstation was laid out comes back when the page is loaded again":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("3 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      const library = page.getByRole("region", { name: "Library" });
      await library.getByRole("button", { name: "Space" }).click();
      await library.getByRole("option", { name: DELAY }).first().dblclick();
      const slot = page.locator("[data-slot=device-chain-slot]").first();
      await slot.getByRole("button", { name: FOLD }).click();
      await slot.locator("[data-slot=device-chain-strip]").waitFor();
      // A track folded, the mixer's view shown, zoomed in and scrolled, the metronome on.
      await page
        .locator('[aria-label="4 Audio"][data-track-id]')
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
          .locator('[aria-label="4 Audio"][data-track-id]')
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
  "PRJ-009: New project replaces the project, and a reload keeps the new one":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, "[data-add-track]", "Old take", 1);
      await page.waitForSelector('[aria-label="Old take"][data-track-id]');
      await page.waitForSelector("text=Saved", { timeout: 5000 });
      await page.getByRole("button", { name: "More controls" }).click();
      await page.getByRole("menuitem", { name: "New project" }).click();
      // The test project has a "1 MIDI" track too: wait for the old take to go, not for one to come.
      const gone = await page
        .locator('[aria-label="Old take"][data-track-id]')
        .waitFor({ state: "detached", timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      assert(gone, "the old track is still there");
      await page.waitForSelector('[aria-label="1 MIDI"][data-track-id]');
      await page.waitForSelector("text=Saved", { timeout: 5000 });
      await open(browser, page);
      await page.waitForSelector('[aria-label="1 MIDI"][data-track-id]', {
        timeout: 10_000,
      });
      assert(
        (await page
          .locator('[aria-label="Old take"][data-track-id]')
          .count()) === 0,
        "a reload brought the old project back"
      );
    },
  "PRJ-009: a new project belongs to no folder, so a save after a reload asks for one":
    async (browser) => {
      const context = await browser.newContext({
        viewport: { height: 1000, width: 1440 },
      });
      const shared = await context.newPage();
      // The picker gives a folder of the private storage, and counts the times it is asked.
      await shared.addInitScript(() => {
        const counted = window as unknown as {
          picks: number;
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        };
        counted.picks = 0;
        counted.showDirectoryPicker = async () => {
          counted.picks += 1;
          return (
            await (
              await navigator.storage.getDirectory()
            ).getDirectoryHandle("picked", { create: true })
          ).getDirectoryHandle("Mirages", { create: true });
        };
      });
      const page = await open(browser, shared);
      await page.keyboard.press("Meta+KeyS");
      await page.getByText("Saved to Mirages").waitFor({ timeout: 10_000 });
      await page.getByRole("button", { name: "More controls" }).click();
      await page.getByRole("menuitem", { name: "New project" }).click();
      await page.waitForSelector("text=Saved", { timeout: 5000 });
      await open(browser, page);
      await page.waitForSelector('[aria-label="1 MIDI"][data-track-id]');
      await page.keyboard.press("Meta+KeyS");
      await page.getByText("Saved to Mirages").waitFor({ timeout: 10_000 });
      const picks = await page.evaluate(
        () => (window as unknown as { picks: number }).picks
      );
      assert(
        picks === 1,
        `the save asked for a folder ${picks} times, not once`
      );
    },
};
