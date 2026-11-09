/** The checks of docs/daw-spec/midi.md. */
import { assert, type Checks, loudest, open, showMixer } from "../helpers";

export const checks: Checks = {
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
      // The roll opens to select: Draw makes a click lay a note.
      await page.getByRole("button", { exact: true, name: "Draw" }).click();
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
};
