/** The checks of docs/daw-spec/shortcuts.md. */
import { assert, type Checks, open } from "../helpers";

export const checks: Checks = {
  "KEY-021: Cmd+Option+B folds the library and shows it again": async (
    browser
  ) => {
    const page = await open(browser);
    await page.getByRole("region", { name: "Library" }).waitFor();
    await page.keyboard.press("Meta+Alt+KeyB");
    await page.locator("button[data-slot=device-browser]").waitFor();
    await page.keyboard.press("Meta+Alt+KeyB");
    await page.getByRole("region", { name: "Library" }).waitFor();
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
      await page.getByText("4 Audio", { exact: true }).first().click();
      await page.keyboard.press("Delete");
      await page.waitForFunction(
        (tracks) =>
          document.querySelectorAll("[data-track]").length === tracks - 1,
        before
      );
      await page.getByRole("button", { exact: true, name: "Undo" }).click();
      await page.waitForFunction(
        (tracks) => document.querySelectorAll("[data-track]").length === tracks,
        before
      );
    },
  "KEY-012: Delete on a note of the clip view takes the note, and the clip stays":
    async (browser) => {
      const page = await open(browser);
      const lane = await page.locator('[data-track="track-3"]').boundingBox();
      assert(lane, "the MIDI lane is there");
      await page.mouse.dblclick(lane.x + 4, lane.y + lane.height / 2);
      const grid = await page.waitForSelector("[data-slot=piano-roll-grid]", {
        timeout: 5000,
      });
      const box = await grid.boundingBox();
      assert(box, "the piano roll is open");
      await page.getByRole("button", { exact: true, name: "Draw" }).click();
      await page.mouse.click(box.x + 20, box.y + box.height / 2);
      await page.getByRole("button", { exact: true, name: "Draw" }).click();
      const notes = page.locator(
        '[data-slot="piano-roll-grid"] [role="button"][aria-pressed]'
      );
      await notes.first().waitFor({ timeout: 5000 });
      const clips = page.locator('[data-track="track-3"] [data-clip-id]');
      const before = await clips.count();
      await notes.first().click();
      await page.keyboard.press("Delete");
      await page.waitForFunction(
        () =>
          document.querySelectorAll(
            '[data-slot="piano-roll-grid"] [role="button"][aria-pressed]'
          ).length === 0,
        undefined,
        { timeout: 5000 }
      );
      await page.waitForTimeout(100);
      assert(
        (await clips.count()) === before,
        "Delete on a note took its clip too"
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
};
