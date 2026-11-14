/** The checks of docs/daw-spec/devices.md. */
import {
  assert,
  type Checks,
  DELAY,
  dropChord,
  FOLD,
  loudest,
  open,
  POCKET_SYNTH,
  showMixer,
  UNFOLD,
  UTILITY,
} from "../helpers";

export const checks: Checks = {
  "DEV-003: a device double-clicked in the library goes on the selected track":
    async (browser) => {
      const page = await open(browser);
      await page
        .locator('[aria-label="4 Audio"][data-track-id]')
        .getByText("4 Audio")
        .click();
      const library = page.getByRole("region", { name: "Library" });
      await library.getByRole("button", { name: "Space" }).click();
      await library.getByRole("option", { name: DELAY }).first().dblclick();
      const devices = page.getByRole("region", { name: "Devices" });
      // The panel's bar names the track whose devices it shows.
      await page
        .locator("[data-slot=panel-bar]")
        .getByText("4 Audio")
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
  "DEV-013: a drum rack on a MIDI track plays a pad when it is struck, and a voice picked on an empty pad makes one":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("1 MIDI", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      // The track has its synth: the strip that ends the chain adds racks.
      await page.getByRole("button", { name: "Add a rack" }).click();
      await page.getByRole("menuitem", { name: "Drum rack" }).click();
      const drums = page.locator("[data-slot=drum-rack-panel]");
      await drums.waitFor({ timeout: 5000 });
      const pads = drums.getByRole("group", { name: "Pads" });
      await Promise.all(
        ["Kick C2", "Snare D2", "Closed Hat F#2"].map((name) =>
          pads.getByLabel(name, { exact: true }).waitFor()
        )
      );
      // The kick rings four seconds: long enough to hear it on the main track's meter, in the mixer.
      await drums.getByRole("slider", { exact: true, name: "Decay" }).focus();
      await page.keyboard.press("End");
      await pads.getByLabel("Kick C2", { exact: true }).click({ delay: 50 });
      await showMixer(page);
      const level = await loudest(page, 800);
      assert(level > -40, `the kick pad struck plays at ${level} dB`);
      await page.getByRole("tab", { name: "Devices" }).click();
      await pads.getByLabel("Empty E2", { exact: true }).click();
      await drums
        .getByRole("group", { name: "Pad E2" })
        .getByRole("button", { name: "Snare" })
        .click();
      await pads.getByLabel("Snare E2", { exact: true }).waitFor();
    },
  "DEV-013: a recording dropped on a pad fills it, plays when the pad is struck, and comes back with the project":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("1 MIDI", { exact: true }).first().click();
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
      await page.getByText("1 MIDI", { exact: true }).first().click();
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
      await page.getByText("1 MIDI", { exact: true }).first().click();
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
      await page.getByText("2 MIDI", { exact: true }).first().click();
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
      await page.getByText("2 MIDI", { exact: true }).first().click();
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
      await page.getByText("3 Audio", { exact: true }).first().click();
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
      await page.getByText("3 Audio", { exact: true }).first().click();
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
      // A short press lifts nothing: it is a click on the title bar, which folds the device, and a click on its strip opens it again.
      await page.mouse.move(pressAt, y);
      await page.mouse.down();
      await page.mouse.move(pressAt + 2, y);
      await page.mouse.up();
      assert((await ghost.count()) === 0, "a press of 2 px lifted the device");
      await slots.nth(0).locator("[data-slot=device-chain-strip]").waitFor();
      await slots
        .nth(0)
        .locator("[data-slot=device-chain-strip]")
        .click({ position: { x: 14, y: 80 } });
      await slots.nth(0).locator("[data-slot=device-header]").waitFor();
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
  "DEV-004: a device held from the library over a rack lights its chain, not the track's":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("3 Audio", { exact: true }).first().click();
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
      await page.getByText("3 Audio", { exact: true }).first().click();
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
      // Its arrow is always there, at the bottom, with the name over it.
      await page.mouse.move(0, 0);
      const name = await strip.locator("span[title]").boundingBox();
      const last = await arrow.boundingBox();
      assert(
        !!name &&
          !!last &&
          name.y + name.height <= last.y &&
          box.y + box.height - (last.y + last.height) <= 6,
        `the strip's bottom reads ${JSON.stringify({ last, name })}`
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
  "DEV-006: a press on a device's title bar folds it, a press on its buttons does not, and a drag of it moves it without folding":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("3 Audio", { exact: true }).first().click();
      await page.getByRole("tab", { name: "Devices" }).click();
      const library = page.getByRole("region", { name: "Library" });
      await library.getByLabel("Search the devices").fill("Limiter");
      await library.getByRole("option").first().dblclick();
      const slot = page.locator("[data-slot=device-chain-slot]").first();
      await slot.waitFor({ timeout: 5000 });
      const strip = slot.locator("[data-slot=device-chain-strip]");
      const header = slot.locator("[data-slot=device-header]").first();
      const title = header.getByText("Limiter", { exact: true });
      // The on square is a button: a press on it switches the device and leaves it open.
      await slot.locator("button[aria-pressed]").first().click();
      await page.waitForTimeout(100);
      assert((await strip.count()) === 0, "the on square folded the device");
      // A drag of the title bar is a move, not a press.
      const bar = await header.boundingBox();
      if (!bar) {
        throw new Error("the title bar is not on the page");
      }
      await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
      await page.mouse.down();
      await page.mouse.move(bar.x + bar.width / 2 + 40, bar.y + 6, {
        steps: 4,
      });
      await page.mouse.up();
      await page.waitForTimeout(150);
      assert((await strip.count()) === 0, "a drag of the title bar folded it");
      // A press on the name folds it, and one on the strip opens it again.
      await title.click();
      await strip.waitFor({ timeout: 2000 });
      await strip.click({ position: { x: 14, y: 80 } });
      await header.waitFor({ timeout: 2000 });
    },

  "DEV-010: a rack's chain has no scroll of its own, and the strip that ends the track's chain stays at the right":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("3 Audio", { exact: true }).first().click();
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
      const strip = page
        .getByTestId("devices")
        .getByRole("button", { name: "Add a rack" });
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
};
