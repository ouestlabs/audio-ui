/** The checks of docs/daw-spec/recording.md. */
import { assert, type Checks, loudest, open, showMixer } from "../helpers";

export const checks: Checks = {
  "REC-001: a track's Arm button is a light, lit while it is armed, and says so as a pressed button":
    async (browser) => {
      const page = await open(browser);
      const arm = page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Arm 3 Audio" });
      const light = arm.locator("[data-slot=led]");
      assert((await light.count()) === 1, "the Arm button has no light");
      assert(
        (await arm.getAttribute("aria-pressed")) === "false" &&
          (await light.getAttribute("data-on")) === null,
        "the light is on before the track is armed"
      );
      await arm.click();
      assert(
        (await arm.getAttribute("aria-pressed")) === "true" &&
          (await light.getAttribute("data-on")) === "",
        "armed, the light stays off"
      );
      assert(
        (await arm.getByRole("img").count()) === 0,
        "the light says its state over the button's"
      );
    },
  "REC-004: an armed audio track records a take from the cursor, which plays back as a clip; one undo takes it away":
    async (browser) => {
      const page = await open(browser);
      const clips = page.locator('[data-track="track-1"] [data-clip-id]');
      const before = await clips.count();
      await page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Arm 3 Audio" })
        .click();
      assert(
        (await page
          .locator("[data-slot=timeline-track-header]")
          .getByRole("button", { name: "Arm 3 Audio" })
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
  "REC-004: Space ends a take Record just started, even with the button focused, and Space again plays without recording":
    async (browser) => {
      const page = await open(browser);
      await page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Arm 1 MIDI" })
        .click();
      const record = page.getByRole("button", { exact: true, name: "Record" });
      const takes = page.locator('[data-slot="arranged-take"]');
      // The press leaves Record focused: Space must not click it again as the key comes up.
      await record.click();
      await takes.waitFor({ timeout: 5000 });
      await page.keyboard.press("Space");
      await page.waitForFunction(
        () => !document.querySelector('[data-slot="arranged-take"]'),
        undefined,
        { timeout: 5000 }
      );
      assert(
        (await record.getAttribute("aria-pressed")) === "false",
        "Space ended the take and Record is off"
      );
      await page.keyboard.press("Space");
      await page
        .getByRole("button", { exact: true, name: "Pause" })
        .waitFor({ timeout: 5000 });
      await page.waitForTimeout(800);
      assert(
        (await takes.count()) === 0 &&
          (await record.getAttribute("aria-pressed")) === "false",
        "Space again plays, and records nothing"
      );
    },
  "REC-004: Record pressed again before the take has started stops it, and leaves no input open":
    async (browser) => {
      const context = await browser.newContext({
        viewport: { height: 1000, width: 1440 },
      });
      const shared = await context.newPage();
      // The input is granted late, as after a prompt, and every stream the page gets is kept to look at.
      await shared.addInitScript(() => {
        const devices = navigator.mediaDevices;
        const ask = devices.getUserMedia.bind(devices);
        const scope = window as unknown as { streams: MediaStream[] };
        scope.streams = [];
        devices.getUserMedia = async (constraints) => {
          const stream = await ask(constraints);
          scope.streams.push(stream);
          await new Promise((resolve) => setTimeout(resolve, 500));
          return stream;
        };
      });
      const page = await open(browser, shared);
      // An armed audio track: the take asks for the input.
      await page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Arm 3 Audio" })
        .click();
      const record = page.getByRole("button", { exact: true, name: "Record" });
      await record.click();
      await record.click();
      await page.waitForTimeout(1500);
      assert(
        (await record.getAttribute("aria-pressed")) === "false" &&
          (await page.locator('[data-slot="arranged-take"]').count()) === 0,
        "the second press stopped the take before it started"
      );
      const live = await page.evaluate(
        () =>
          (window as unknown as { streams: MediaStream[] }).streams
            .flatMap((stream) => stream.getTracks())
            .filter((track) => track.readyState === "live").length
      );
      assert(live === 0, `${live} input tracks are still open`);
    },
  "REC-003: a take started while Monitor still waits for the input shares it, and Monitor off closes it":
    async (browser) => {
      const context = await browser.newContext({
        viewport: { height: 1000, width: 1440 },
      });
      const shared = await context.newPage();
      // The input is granted late, as after a prompt, and every stream the page asks for is kept to look at.
      await shared.addInitScript(() => {
        const devices = navigator.mediaDevices;
        const ask = devices.getUserMedia.bind(devices);
        const scope = window as unknown as { streams: MediaStream[] };
        scope.streams = [];
        devices.getUserMedia = async (constraints) => {
          const stream = await ask(constraints);
          scope.streams.push(stream);
          await new Promise((resolve) => setTimeout(resolve, 800));
          return stream;
        };
      });
      const page = await open(browser, shared);
      const monitor = async () => {
        await page.getByRole("button", { name: "Record settings" }).click();
        await page
          .getByRole("menuitemcheckbox", { name: "Monitor input (headphones)" })
          .click();
        await page.keyboard.press("Escape");
      };
      await page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Arm 3 Audio" })
        .click();
      // Monitor asks for the input; Record comes while it waits.
      await monitor();
      const record = page.getByRole("button", { exact: true, name: "Record" });
      await record.click();
      await page.locator('[data-slot="arranged-take"]').waitFor({
        timeout: 5000,
      });
      await record.click();
      await page.waitForTimeout(500);
      const streams = () =>
        page.evaluate(() =>
          (window as unknown as { streams: MediaStream[] }).streams.map(
            (stream) =>
              stream.getTracks().filter((track) => track.readyState === "live")
                .length
          )
        );
      const asked = await streams();
      assert(
        asked.length === 1 && asked[0] === 1,
        `the page asked for ${asked.length} inputs, and holds ${asked.join(", ")} live tracks, not one shared input`
      );
      await monitor();
      await page.waitForTimeout(500);
      const left = (await streams()).reduce((sum, live) => sum + live, 0);
      assert(
        left === 0,
        `${left} input tracks are still open with Monitor off`
      );
    },
  "REC-005: a count-in counts the transport back in negative bars before the take starts":
    async (browser) => {
      const page = await open(browser);
      await page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Arm 3 Audio" })
        .click();
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
      await page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Arm 1 MIDI" })
        .click();
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
        .getByRole("button", { name: "Solo 1 MIDI" })
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
      await page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Arm 3 Audio" })
        .click();
      const quiet = await loudest(page, 800);
      await page.getByRole("button", { name: "Record settings" }).click();
      await page
        .getByRole("menuitemcheckbox", { name: "Monitor input (headphones)" })
        .click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
      const heard = await loudest(page, 1000);
      await page
        .locator("[data-slot=timeline-track-header]")
        .getByRole("button", { name: "Arm 3 Audio" })
        .click();
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
};
