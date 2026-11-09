/** The checks of docs/daw-spec/mixer.md. */
import type { Locator } from "playwright-core";
import {
  assert,
  type Checks,
  DEVICES,
  dragKnobVertically,
  dropChord,
  loudest,
  MAIN_LOUDNESS,
  MAIN_PEAK,
  open,
  PAN_KNOB,
  REMOVE,
  SEND_KNOB,
  showMixer,
} from "../helpers";

export const checks: Checks = {
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
        (await page
          .getByRole("group", { exact: true, name: "Mixer" })
          .count()) === 0,
        "the mixer stays open beside the detail view"
      );
    },
  "MIX-016: the main track stays whole at the right of the mixer, and no channel passes under it":
    async (browser) => {
      const page = await open(browser);
      await [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].reduce(async (done) => {
        await done;
        await page.locator("[data-add-track] button").click();
        await page.getByRole("menuitem", { name: "Audio track" }).click();
      }, Promise.resolve());
      await showMixer(page);
      const mixer = page.getByRole("group", { exact: true, name: "Mixer" });
      const channels = mixer.locator("[data-slot=mixer-channels]");
      const main = mixer.getByRole("region", { exact: true, name: "Main" });
      const read = async () => {
        const [view, rows, strip] = [
          await mixer.boundingBox(),
          await channels.boundingBox(),
          await main.boundingBox(),
        ];
        return {
          channelsRight: (rows?.x ?? 0) + (rows?.width ?? 0),
          left: strip?.x ?? 0,
          right: (strip?.x ?? 0) + (strip?.width ?? 0),
          viewRight: (view?.x ?? 0) + (view?.width ?? 0),
        };
      };
      assert(
        await channels.evaluate(
          (element) => element.scrollWidth > element.clientWidth
        ),
        "the channels do not scroll"
      );
      await channels.evaluate((element) => {
        element.scrollLeft = 0;
      });
      await page.waitForTimeout(100);
      const start = await read();
      assert(
        start.right <= start.viewRight + 1 &&
          start.right > start.viewRight - 24,
        `scrolled to the start, the main track ends at ${start.right} in a mixer ending at ${start.viewRight}`
      );
      assert(
        start.channelsRight <= start.left + 1,
        `the channels run to ${start.channelsRight}, under a main track from ${start.left}`
      );
      await channels.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      await page.waitForTimeout(100);
      const end = await read();
      assert(
        Math.abs(end.left - start.left) < 2,
        `the main track moved from ${start.left} to ${end.left}`
      );
      // One line between two channels, and before the main track: no gap, no double line.
      const lines = await mixer.locator("section").evaluateAll((strips) =>
        strips.map((strip) => {
          const style = getComputedStyle(strip);
          return [
            Number.parseFloat(style.borderInlineStartWidth),
            Number.parseFloat(style.borderInlineEndWidth),
          ];
        })
      );
      const doubled = lines.findIndex(
        ([, after], index) => after > 0 && (lines[index + 1]?.[0] ?? 0) > 0
      );
      assert(doubled === -1, `a double line after channel ${doubled + 1}`);
      assert(
        (await channels.locator(":scope > :not(section)").count()) === 0,
        "something other than a channel stands between them"
      );
      // Every fader starts level, the main track's too.
      const tops = await mixer
        .locator("[data-slot=fader-track]")
        .evaluateAll((faders) =>
          faders.map((fader) => Math.round(fader.getBoundingClientRect().top))
        );
      assert(
        new Set(tops).size === 1,
        `the faders start at ${[...new Set(tops)].join(", ")}`
      );
    },
  "MIX-017: a track's channel moves by its name, dragged or with Left and Right, and its row moves with it":
    async (browser) => {
      const page = await open(browser);
      await showMixer(page);
      const mixer = page.getByRole("group", { exact: true, name: "Mixer" });
      const order = () =>
        mixer
          .locator("[data-mixer-track]")
          .evaluateAll((strips) =>
            strips.map((strip) => strip.getAttribute("aria-label"))
          );
      const rows = () =>
        page
          .locator("[data-track-id]")
          .evaluateAll((items) =>
            items.map((item) => item.getAttribute("aria-label"))
          );
      const before = await order();
      const [first, second] = before;
      assert(first && second, "there are two tracks");
      const grip = mixer.getByRole("button", { name: `Move ${first}` });
      const from = await grip.boundingBox();
      const target = await mixer
        .getByRole("button", { name: `Move ${second}` })
        .boundingBox();
      assert(from && target, "the names are there");
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        target.x + target.width,
        target.y + target.height / 2,
        { steps: 8 }
      );
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(300);
      const dragged = await order();
      assert(
        dragged[0] === second && dragged[1] === first,
        `dragged past the next, the order is ${dragged.join(", ")}`
      );
      assert(
        (await rows()).slice(0, 2).join() === dragged.slice(0, 2).join(),
        "the arrangement kept its old order"
      );
      await mixer.getByRole("button", { name: `Move ${first}` }).focus();
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(150);
      assert(
        (await order())[0] === first,
        "Left did not move it back to the start"
      );
    },
  "MIX-018: a click on a clip's title bar shows it in the clip view, even over the mixer; a drag of it does not":
    async (browser) => {
      const page = await open(browser);
      // On a track of its own: no other clip lies under it.
      // Long enough that its middle is its title bar, clear of its trim handles.
      await dropChord(page, "[data-slot=arrangement-drop]", "Headed", 24);
      const clip = page.locator("[data-clip-id]", { hasText: "Headed" });
      await clip.waitFor({ timeout: 30_000 });
      await showMixer(page);
      const head = clip.locator("[data-slot=timeline-clip-header]");
      const press = async (travel: number) => {
        await head.scrollIntoViewIfNeeded();
        const box = await head.boundingBox();
        assert(box, "the title bar is there");
        const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
        const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + travel, y, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(150);
      };
      const clipShown = async () =>
        (await page
          .getByRole("tab", { name: "Clip" })
          .getAttribute("aria-selected")) === "true";
      await press(60);
      assert(!(await clipShown()), "a drag of the clip took the mixer away");
      await press(0);
      assert(await clipShown(), "a click on the title bar left the mixer");
    },
  "MIX-019: a channel's switches are its track header's: Solo, Mute and an Arm light, one group, each moved by the other":
    async (browser) => {
      const page = await open(browser);
      await showMixer(page);
      const mixer = page.getByRole("group", { exact: true, name: "Mixer" });
      const channel = mixer.getByRole("group", { name: "3 Audio switches" });
      const header = page
        .getByRole("group", { name: "3 Audio switches" })
        .filter({ hasNot: mixer });
      await channel.getByRole("button", { name: "Arm 3 Audio" }).click();
      assert(
        (await header
          .first()
          .getByRole("button", { name: "Arm 3 Audio" })
          .getAttribute("aria-pressed")) === "true",
        "armed in the mixer, the header's Arm stays off"
      );
      // Inside its channel, as far from either edge.
      const [strip, switches] = [
        await mixer
          .getByRole("region", { exact: true, name: "3 Audio" })
          .boundingBox(),
        await channel.boundingBox(),
      ];
      const left = (switches?.x ?? 0) - (strip?.x ?? 0);
      const right =
        (strip?.x ?? 0) +
        (strip?.width ?? 0) -
        (switches?.x ?? 0) -
        (switches?.width ?? 0);
      const bottom =
        (strip?.y ?? 0) +
        (strip?.height ?? 0) -
        (switches?.y ?? 0) -
        (switches?.height ?? 0);
      assert(
        Math.abs(left - right) <= 1.5 && Math.abs(left - bottom) <= 1.5,
        `the switches sit ${left} px from the left of their channel, ${right} px from the right and ${bottom} px from the bottom`
      );
      await page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Mute 3 Audio" })
        .click();
      assert(
        (await channel
          .getByRole("button", { name: "Mute 3 Audio" })
          .getAttribute("aria-pressed")) === "true",
        "muted in the header, the channel's Mute stays off"
      );
    },
  "MIX-015: the library and the panel fold by a press anywhere on their bar, not only on its caret":
    async (browser) => {
      const page = await open(browser);
      // Pressed on a bar's title, far from its caret.
      const pressTitle = async (holder: Locator, text: string) => {
        const title = await holder
          .getByText(text, { exact: true })
          .boundingBox();
        assert(title, `the ${text} bar is there`);
        await page.mouse.click(
          (title?.x ?? 0) + 4,
          (title?.y ?? 0) + (title?.height ?? 0) / 2
        );
      };
      await pressTitle(
        page.getByRole("region", { name: "Library" }),
        "Library"
      );
      await page
        .locator("button[data-slot=device-browser]")
        .waitFor({ timeout: 3000 });
      await page.getByRole("tab", { name: DEVICES }).click();
      const bar = page.locator("[data-slot=panel-bar]");
      const box = await bar.boundingBox();
      assert(box, "the panel's bar is there");
      await page.mouse.click(
        (box?.x ?? 0) + (box?.width ?? 0) / 2,
        (box?.y ?? 0) + (box?.height ?? 0) / 2
      );
      await page
        .getByRole("button", { name: "Open the panel" })
        .waitFor({ timeout: 3000 });
      // A tab on the bar still does what a tab does: another view, the panel open on it.
      await page.getByRole("tab", { name: "Mixer" }).click();
      await page
        .getByRole("button", { name: "Fold the panel" })
        .waitFor({ timeout: 3000 });
    },
  "MIX-015: the panel open stays open from tab to tab, whatever height a view kept":
    async (browser) => {
      const page = await open(browser);
      // A height kept from before, under what the clip view needs now.
      await page.evaluate(() => {
        const key = "audio-ui-daw:view";
        const view = JSON.parse(localStorage.getItem(key) ?? "{}");
        view.panelHeights = { ...view.panelHeights, clip: 40 };
        view.panelFolded = false;
        view.panelView = "devices";
        localStorage.setItem(key, JSON.stringify(view));
      });
      await page.reload();
      await page.waitForSelector("[data-track-id]", { timeout: 30_000 });
      await dropChord(page, '[data-track="track-1"]', "Kept", 4);
      const clip = page.locator("[data-clip-id]", { hasText: "Kept" });
      await clip.waitFor({ timeout: 30_000 });
      await page.getByRole("tab", { name: DEVICES }).click();
      await page.getByRole("button", { name: "Fold the panel" }).waitFor();
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      await page.waitForTimeout(300);
      assert(
        (await page.getByRole("button", { name: "Open the panel" }).count()) ===
          0,
        "on the clip's tab, the panel folded"
      );
    },
  "MIX-015: a press on the tab already shown opens the folded panel": async (
    browser
  ) => {
    const page = await open(browser);
    await page.getByRole("tab", { name: DEVICES }).click();
    await page.getByRole("button", { name: "Fold the panel" }).click();
    await page.getByRole("button", { name: "Open the panel" }).waitFor();
    await page.getByRole("tab", { name: DEVICES }).click();
    await page
      .getByRole("button", { name: "Fold the panel" })
      .waitFor({ timeout: 3000 });
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
      // The frames the page paints from here: a failure says whether it was busy or lost the pointer.
      await page.evaluate(() => {
        const painted = globalThis as unknown as { painted: number };
        painted.painted = 0;
        const tick = () => {
          painted.painted += 1;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 6 });
      // The line follows the pointer a frame behind: released before it catches up, the last step is lost.
      // Late in a long run the page can paint nothing for seconds, so it is given ten.
      const view = await page
        .getByRole("region", { exact: true, name: "Devices" })
        .elementHandle();
      await page
        .waitForFunction(
          ([element, least]) =>
            (element?.getBoundingClientRect().height ?? 0) >= least,
          [view, devices + 116] as const,
          { timeout: 10_000 }
        )
        .catch(() => undefined);
      await page.mouse.up();
      await page.waitForTimeout(100);
      const taller = await height("Devices");
      const painted = await page.evaluate(
        () => (globalThis as unknown as { painted: number }).painted
      );
      assert(
        Math.abs(taller - devices - 120) < 4,
        `dragged up 120 px, the detail view went from ${devices} to ${taller}, the page painting ${painted} frames meanwhile`
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
  "MIX-015: on a short window the mixer opens with every channel whole, its switches included":
    async (browser) => {
      // Short from the start: a panel opens by the window's height.
      const page = await open(
        browser,
        await (
          await browser.newContext({ viewport: { height: 749, width: 1440 } })
        ).newPage()
      );
      await showMixer(page);
      const mixer = page.getByRole("group", { exact: true, name: "Mixer" });
      const [view, switches] = [
        await mixer.boundingBox(),
        await mixer
          .locator("[data-slot=mixer-channels] section")
          .first()
          .locator("[data-slot=toggle-group]")
          .boundingBox(),
      ];
      assert(view && switches, "the mixer and its first channel are there");
      assert(
        switches.y + switches.height <= view.y + view.height + 0.5,
        `the switches end at ${switches.y + switches.height}, under the mixer's ${view.y + view.height}`
      );
    },
  "MIX-015: each row of sends a return adds makes the mixer taller, so every channel stays whole":
    async (browser) => {
      const page = await open(
        browser,
        await (
          await browser.newContext({ viewport: { height: 749, width: 1440 } })
        ).newPage()
      );
      await showMixer(page);
      // The set has two returns: four more make six, three rows of two sends.
      await [1, 2, 3, 4].reduce(async (done) => {
        await done;
        await page.locator("[data-add-track] button").click();
        await page.getByRole("menuitem", { name: "Return track" }).click();
      }, Promise.resolve());
      await page.waitForTimeout(400);
      const mixer = page.getByRole("group", { exact: true, name: "Mixer" });
      const [view, switches] = [
        await mixer.boundingBox(),
        await mixer
          .locator("[data-slot=mixer-channels] section")
          .first()
          .locator("[data-slot=toggle-group]")
          .boundingBox(),
      ];
      assert(view && switches, "the mixer and its first channel are there");
      assert(
        switches.y + switches.height <= view.y + view.height + 0.5,
        `six sends: the switches end at ${switches.y + switches.height}, under the mixer's ${view.y + view.height}`
      );
    },
  "MIX-024: a MIDI track with no instrument has no volume, pan or sends, in the mixer and in its header, and an instrument brings them back":
    async (browser) => {
      const page = await open(browser);
      await page.getByText("1 MIDI", { exact: true }).first().click();
      const controls = (name: string) =>
        page.getByRole("slider", { name: `1 MIDI ${name}` });
      await showMixer(page);
      assert(
        (await controls("pan").count()) === 2,
        "the new MIDI track has no pan in its header and its channel"
      );
      await page.getByRole("tab", { name: "Devices" }).click();
      await page.getByRole("button", { name: REMOVE }).first().click();
      await page.getByRole("tab", { name: "Mixer" }).click();
      await page.waitForFunction(
        () =>
          !document.querySelector(
            '[aria-label="1 MIDI pan"], [aria-label="1 MIDI volume"]'
          ),
        undefined,
        { timeout: 5000 }
      );
      assert(
        (await page.getByRole("group", { name: "1 MIDI sends" }).count()) === 0,
        "the channel still has sends"
      );
      assert(
        (await page.getByLabel("1 MIDI gain").count()) === 0,
        "the header still has a gain"
      );
      assert(
        (await page.getByRole("button", { name: "Mute 1 MIDI" }).count()) > 0,
        "the switches went with the volume"
      );
      assert(
        (await controls("pan").count()) === 0 &&
          (await page.getByRole("slider", { name: "2 MIDI pan" }).count()) > 0,
        "another MIDI track lost its pan"
      );
      // Its lane has no volume or pan envelope to draw either.
      await page.keyboard.press("KeyA");
      await page
        .getByRole("combobox", { name: "2 MIDI automation" })
        .waitFor({ timeout: 5000 });
      assert(
        (await page
          .getByRole("combobox", { name: "1 MIDI automation" })
          .count()) === 0 &&
          (await page.getByLabel("1 MIDI volume automation").count()) === 0,
        "the track with no output still offers a volume to automate"
      );
      // An instrument given again brings them back.
      await page
        .getByRole("region", { name: "Library" })
        .getByLabel("Search the devices")
        .fill("Pocket Synth");
      await page
        .getByRole("region", { name: "Library" })
        .getByRole("option", { name: "Pocket Synth" })
        .first()
        .dblclick();
      // The header's pan and the channel's, both.
      await page.getByRole("tab", { name: "Mixer" }).click();
      await controls("pan").nth(1).waitFor({ timeout: 5000 });
      await page
        .getByRole("combobox", { name: "1 MIDI automation" })
        .waitFor({ timeout: 5000 });
    },
  "MIX-023: a channel's pan and sends turn by a drag up and down, and a drag across moves nothing":
    async (browser) => {
      const page = await open(browser);
      await showMixer(page);
      const mixer = page.getByRole("group", { exact: true, name: "Mixer" });
      await dragKnobVertically(
        page,
        mixer.getByRole("slider", { name: PAN_KNOB }).first(),
        "the channel's pan"
      );
      await dragKnobVertically(
        page,
        mixer.getByRole("slider", { name: SEND_KNOB }).first(),
        "the channel's send"
      );
      // A knob of the registry's own timeline, not written by the workstation.
      await dragKnobVertically(
        page,
        page
          .locator("[data-track-id]")
          .first()
          .getByRole("slider", { name: PAN_KNOB })
          .first(),
        "the track header's pan"
      );
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
  "MIX-011: every channel holds its loudest peak, a track's as well as the main track's, until it is clicked":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Loud take", 3);
      await page.locator("[data-clip-id]", { hasText: "Loud take" }).waitFor({
        timeout: 30_000,
      });
      await showMixer(page);
      const own = page.getByRole("button", { name: "3 Audio peak" });
      const silent = page.getByRole("button", { name: "4 Audio peak" });
      assert((await own.innerText()) === "-∞", "a track's peak starts at -∞");
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      await page.waitForTimeout(1200);
      await page.keyboard.press("Space");
      const held = await own.innerText();
      assert(held !== "-∞" && Number(held) > -40, `the track held ${held}`);
      assert(
        (await silent.innerText()) === "-∞",
        "a track that played nothing held a peak"
      );
      await own.click();
      assert((await own.innerText()) === "-∞", "a click did not clear it");
    },
  "MIX-025: the main track reads the mix's loudness in LUFS until it is clicked":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, "[data-add-track]", "Chord take");
      await page.waitForSelector('[aria-label="Chord take"][data-track-id]');
      await showMixer(page);
      const loudness = page.getByRole("button", { name: MAIN_LOUDNESS });
      assert(
        (await loudness.innerText()) === "-∞ LUFS",
        "the loudness starts at -∞"
      );
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      await page.waitForTimeout(1500);
      await page.keyboard.press("Space");
      const read = Number.parseFloat(await loudness.innerText());
      assert(read > -40 && read < 0, `the mix read ${read} LUFS`);
      assert(
        (await loudness.getAttribute("aria-label")) ===
          `Main loudness ${Math.round(read)} LUFS, click to clear`,
        "its name does not say the loudness to the LU"
      );
      await loudness.click();
      assert(
        (await loudness.innerText()) === "-∞ LUFS",
        "a click did not clear it"
      );
    },
  "MIX-022: a track's header meters it: the track that plays reads a level, a thin pair, and the others none":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 8);
      await page.waitForSelector("[data-clip-id]", { timeout: 10_000 });
      const level = page.getByRole("group", { name: "3 Audio level" });
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
              .querySelector('[aria-label="3 Audio level"] [aria-valuenow]')
              ?.getAttribute("aria-valuenow")
          ) > -40,
        undefined,
        { timeout: 10_000 }
      );
      const other = await read("4 Audio level");
      await page.keyboard.press("Space");
      assert(!(other > -40), `the silent track reads ${other} dB`);
    },
  "MIX-015: the Devices tab shows the devices of the track of the clip picked, not of a track or a return picked before it":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Chord take", 30);
      const clip = page.locator("[data-clip-id]", { hasText: "Chord take" });
      await clip.waitFor({ timeout: 30_000 });
      const title = page.locator('[data-slot="panel-bar"]');
      // A return picked first: its devices are the ones the tab shows.
      await showMixer(page);
      await page
        .getByRole("region", { exact: true, name: "A Reverb" })
        .click({ position: { x: 20, y: 6 } });
      await page.getByRole("tab", { name: "Devices" }).click();
      assert(
        ((await title.textContent()) ?? "").includes("A Reverb"),
        "the Devices tab shows the return that was picked"
      );
      const bar = clip.locator("[data-slot=timeline-clip-header]");
      await bar.scrollIntoViewIfNeeded();
      const head = (await bar.boundingBox()) ?? {
        height: 0,
        width: 0,
        x: 0,
        y: 0,
      };
      await page.mouse.click(head.x + head.width / 2, head.y + head.height / 2);
      await page.waitForTimeout(300);
      await page.getByRole("tab", { name: "Devices" }).click();
      const shown = (await title.textContent()) ?? "";
      assert(
        shown.includes("3 Audio") && !shown.includes("A Reverb"),
        `the Devices tab shows the clip's track, not the return (${shown})`
      );
    },
  "MIX-020: Cmd+G groups the picked track, its sound plays through the group, and folding the group hides it":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Grouped take", 2);
      await page.getByText("3 Audio", { exact: true }).first().click();
      await page.keyboard.press("Meta+KeyG");
      await page.getByText("Group 1", { exact: true }).first().waitFor();
      const depth = await page
        .locator('[aria-label="3 Audio"][data-track-id] [data-depth]')
        .first()
        .getAttribute("data-depth");
      assert(depth === "1", `the grouped track sits at depth ${depth}`);
      // Drawn in the render after the group's name: under load, read too soon it is not there yet.
      await page
        .locator("[data-slot=arranged-group-preview] > div")
        .first()
        .waitFor({ timeout: 5000 });
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
        () => !document.querySelector('[aria-label="3 Audio"][data-track-id]')
      );
      await page.keyboard.press("Meta+Shift+KeyG");
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label="3 Audio"][data-track-id]') &&
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
      await menu("3 Audio", "Group");
      await page.getByText("Group 1", { exact: true }).first().waitFor();
      await showMixer(page);
      await page
        .getByRole("region", { name: "3 Audio" })
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
  "MIX-002: a track's fader and its mixer channel are one fader: the same range and the same place, each moved by the other":
    async (browser) => {
      const page = await open(browser);
      await page.getByRole("tab", { name: "Mixer" }).click();
      const track = page.getByRole("slider", { name: "4 Audio gain" });
      const channel = page.getByRole("slider", { name: "4 Audio volume" });
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
};
