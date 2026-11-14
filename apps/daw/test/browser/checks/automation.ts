/** The checks of docs/daw-spec/automation.md. */
import {
  assert,
  type Checks,
  expectChanged,
  open,
  showMixer,
  UTILITY,
} from "../helpers";

export const checks: Checks = {
  "AUT-001 and AUT-003: a track's chooser lists its devices' parameters, one is drawn, and a knob turned by hand overrides it":
    async (browser) => {
      const page = await open(browser);
      await page
        .locator('[aria-label="3 Audio"][data-track-id]')
        .getByText("3 Audio")
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
      await page.getByRole("combobox", { name: "3 Audio automation" }).click();
      await page.getByRole("option", { exact: true, name: "Gain" }).click();
      const lane = page.getByRole("group", {
        name: "3 Audio utility gain automation",
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
        .locator('[aria-label="3 Audio"][data-track-id]')
        .getByText("3 Audio")
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
      await ramp("3 Audio volume automation");
      // The track's volume is its mixer channel's fader.
      await page.getByRole("tab", { name: "Mixer" }).click();
      const gain = page.getByRole("slider", { name: "3 Audio volume" });
      const fromGain = await gain.inputValue();
      await page.getByRole("tab", { name: "Devices" }).click();
      await page.getByRole("combobox", { name: "3 Audio automation" }).click();
      await page.getByRole("option", { exact: true, name: "Gain" }).click();
      await ramp("3 Audio utility gain automation");
      const knob = devices.getByRole("slider", { name: "Gain" }).first();
      const fromKnob = await knob.inputValue();
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Space");
      await expectChanged(knob, fromKnob);
      await page.getByRole("tab", { name: "Mixer" }).click();
      await expectChanged(gain, fromGain);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Space");
      await page.getByRole("tab", { name: "Devices" }).click();
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
        .locator('[aria-label="3 Audio"][data-track-id]')
        .getByText("3 Audio")
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
      await ramp("3 Audio volume automation", "ArrowDown");
      await page.getByRole("combobox", { name: "3 Audio automation" }).click();
      await page.getByRole("option", { exact: true, name: "Macro 1" }).click();
      await ramp("3 Audio rack macro 1 automation", "ArrowUp");
      const macro = rack.getByRole("slider", { name: "Macro 1" });
      const fromMacro = await macro.inputValue();
      assert(fromMacro !== "0", "the macro stands where its envelope starts");
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Space");
      await expectChanged(macro, fromMacro);
      await showMixer(page);
      const fader = page.getByRole("slider", { name: "3 Audio volume" });
      await expectChanged(fader, await fader.inputValue());
      await page.keyboard.press("Space");
    },
};
