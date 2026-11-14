/** The checks of docs/daw-spec/arrangement.md. */
import encode from "@audio/encode";
import {
  assert,
  type Checks,
  dropChord,
  dropFiles,
  loudest,
  movesLikeAMarker,
  open,
  selectTime,
  showMixer,
  standsOnThePlayhead,
} from "../helpers";

export const checks: Checks = {
  "ARR-006: audio files dropped on the add-track button make a track each, named after them":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, "[data-add-track]", "Chord take");
      await page.waitForSelector('[aria-label="Chord take"][data-track-id]', {
        timeout: 10_000,
      });
      await page.waitForSelector("[data-slot^=timeline-clip-waveform]");
    },
  "ARR-007: AIFF, CAF and Apple Lossless files, which Chrome does not decode, make tracks too":
    async (browser) => {
      const page = await open(browser);
      const rate = 48_000;
      const tone = Float32Array.from(
        { length: rate * 2 },
        (_, frame) => 0.3 * Math.sin((2 * Math.PI * 220 * frame) / rate)
      );
      const channels = [tone, tone];
      await dropFiles(page, "[data-add-track]", [
        {
          bytes: await encode.aiff(channels, {
            bitDepth: 16,
            sampleRate: rate,
          }),
          name: "AIFF take.aiff",
          type: "audio/aiff",
        },
        {
          bytes: await encode.caf(channels, { bitDepth: 16, sampleRate: rate }),
          name: "CAF take.caf",
          type: "audio/x-caf",
        },
        {
          bytes: await encode.m4a(channels, {
            codec: "alac",
            sampleRate: rate,
          }),
          name: "ALAC take.m4a",
          type: "audio/mp4",
        },
      ]);
      await Promise.all(
        ["AIFF take", "CAF take", "ALAC take"].map((name) =>
          page.waitForSelector(`[aria-label="${name}"][data-track-id]`, {
            timeout: 20_000,
          })
        )
      );
      const waveforms = await page
        .locator("[data-slot^=timeline-clip-waveform]")
        .count();
      assert(waveforms >= 3, `${waveforms} waveforms for 3 files`);
    },
  "ARR-027: a track's Solo, Mute and Arm are one group of switches: one stop of Tab, the arrows between them, a color each":
    async (browser) => {
      const page = await open(browser);
      const group = page.getByRole("group", { name: "3 Audio switches" });
      const solo = group.getByRole("button", { name: "Solo 3 Audio" });
      await solo.focus();
      await page.keyboard.press("ArrowRight");
      assert(
        await group
          .getByRole("button", { name: "Mute 3 Audio" })
          .evaluate((element) => element === document.activeElement),
        "Right from Solo did not reach Mute"
      );
      await page.keyboard.press("Space");
      assert(
        (await group
          .getByRole("button", { name: "Mute 3 Audio" })
          .getAttribute("aria-pressed")) === "true",
        "Space did not mute the track"
      );
      // Pressed, Solo and Mute each show a color of their own, not the gray of a pressed button.
      await solo.click();
      const [soloColor, muteColor, restColor] = await Promise.all(
        ["Solo 3 Audio", "Mute 3 Audio", "Solo 4 Audio"].map((name) =>
          page
            .locator("[data-slot=timeline-track-header]")
            .getByRole("button", { exact: true, name })
            .evaluate((element) => getComputedStyle(element).backgroundColor)
        )
      );
      assert(
        new Set([soloColor, muteColor, restColor]).size === 3,
        `Solo ${soloColor}, Mute ${muteColor}, at rest ${restColor}`
      );
      await solo.click();
      await page.keyboard.press("Space");
    },
  "ARR-010: a track moves by its grip, with Up and Down or dragged": async (
    browser
  ) => {
    const page = await open(browser);
    // The main track's row stays at the bottom, under the returns: only the others move.
    const order = () =>
      page
        .locator('[data-track-id]:not([data-track-id="main"])')
        .evaluateAll((rows) =>
          rows.map((row) => row.getAttribute("aria-label"))
        );
    await page.getByRole("button", { name: "Move 1 MIDI" }).focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-track-id]")
          ?.getAttribute("aria-label") === "2 MIDI"
    );
    const grip = await page
      .getByRole("button", { name: "Move 4 Audio" })
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
          ?.getAttribute("aria-label") === "4 Audio"
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
    await page.getByLabel("4 Audio height").focus();
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
    await page.getByRole("button", { name: "Fold 4 Audio" }).click();
    await page.getByRole("button", { name: "Unfold 4 Audio" }).waitFor();
    const short = (await row.boundingBox())?.height ?? 0;
    assert(short < tall / 2, `folded, the track is ${short} px, from ${tall}`);
    await page.keyboard.press("Alt+KeyU");
    await page.getByRole("button", { name: "Fold 4 Audio" }).waitFor();
    await page.getByText("4 Audio", { exact: true }).first().click();
    await page.keyboard.press("KeyU");
    await page.getByRole("button", { name: "Unfold 4 Audio" }).waitFor();
  },
  "ARR-012: a folded track holds its lane and its clips, with their names, inside its strip":
    async (browser) => {
      const page = await open(browser);
      const row = page.locator(
        '[data-track-id="track-2"] [data-slot=timeline-track]'
      );
      const lane = page.locator('[data-track="track-2"]');
      await dropChord(page, '[data-track="track-2"]', "Take", 4);
      const clip = lane.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await page.getByRole("button", { name: "Fold 4 Audio" }).click();
      await page.getByRole("button", { name: "Unfold 4 Audio" }).waitFor();
      await page.waitForTimeout(100);
      const strip = await row.boundingBox();
      const bottom = (strip?.y ?? 0) + (strip?.height ?? 0);
      const laneBox = await lane.boundingBox();
      const clipBox = await clip.boundingBox();
      assert(
        (laneBox?.y ?? 0) + (laneBox?.height ?? 0) <= bottom + 1,
        `the lane is ${laneBox?.height} px in a strip of ${strip?.height} px`
      );
      assert(
        (clipBox?.y ?? 0) + (clipBox?.height ?? 0) <= bottom + 1,
        `the clip is ${clipBox?.height} px in a strip of ${strip?.height} px`
      );
      const header = await clip
        .locator("[data-slot=timeline-clip-header]")
        .boundingBox();
      assert(
        (header?.height ?? 99) <= (clipBox?.height ?? 0),
        `its name needs ${header?.height} px in a clip of ${clipBox?.height} px`
      );
    },
  "ARR-005: a file carried over a track shows where it would land; under the tracks it makes one":
    async (browser) => {
      const page = await open(browser);
      await page.keyboard.press("Meta+Equal");
      await page.keyboard.press("Meta+Equal");
      await page.waitForTimeout(150);
      const lane = page.locator('[data-track="track-1"]');
      const box = await lane.boundingBox();
      assert(box, "the lane is there");
      const over = (kind: string, x: number) =>
        lane.evaluate(
          (element, { eventKind, offset }) => {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(
              new File(["x"], "a.wav", { type: "audio/wav" })
            );
            const rect = element.getBoundingClientRect();
            element.dispatchEvent(
              new DragEvent(eventKind, {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + offset,
                clientY: rect.top + 10,
                dataTransfer,
              })
            );
          },
          { eventKind: kind, offset: x }
        );
      await over("dragover", 300);
      await page.waitForTimeout(60);
      await over("dragover", 300);
      const line = lane.locator("[data-slot=arrangement-drop-line]");
      await line.waitFor({ timeout: 2000 });
      const shown = await line.boundingBox();
      assert(
        Math.abs((shown?.x ?? 0) - (box.x + 300)) < 60,
        `carried 300 px in, the line is ${(shown?.x ?? 0) - box.x} px in`
      );
      assert(
        ((await line.textContent()) ?? "").length > 0,
        "the line does not say where"
      );
      await over("dragleave", 300);
      await page.waitForTimeout(60);
      assert(!(await line.isVisible()), "the line stayed after the file left");
      const room = await page
        .locator("[data-slot=arrangement-drop]")
        .boundingBox();
      assert((room?.height ?? 0) >= 56, `the room is ${room?.height} px high`);
      const tracks = await page.locator("[data-track-id]").count();
      await dropChord(page, "[data-slot=arrangement-drop]", "Below", 2);
      await page
        .locator("[data-clip-id]", { hasText: "Below" })
        .waitFor({ timeout: 30_000 });
      assert(
        (await page.locator("[data-track-id]").count()) === tracks + 1,
        "under the tracks, the file did not make its own"
      );
    },
  "ARR-026: a file shows where it goes while it is read, on its track and for a new one, and gives way to its clip":
    async (browser) => {
      const page = await open(browser);
      // Gone in a moment: seen as it appears, not looked for after.
      await page.evaluate(() => {
        const seen: string[] = [];
        (window as unknown as { reading: string[] }).reading = seen;
        new MutationObserver(() => {
          for (const element of document.querySelectorAll(
            "[data-slot=arrangement-reading]"
          )) {
            seen.push(element.textContent ?? "");
          }
        }).observe(document.body, { childList: true, subtree: true });
      });
      const seen = () =>
        page.evaluate(() =>
          (window as unknown as { reading: string[] }).reading.splice(0)
        );
      await dropChord(page, '[data-track="track-1"]', "On a track", 8);
      await page
        .locator("[data-clip-id]", { hasText: "On a track" })
        .waitFor({ timeout: 30_000 });
      const onTrack = await seen();
      assert(
        onTrack.some((text) => text.includes("On a track")),
        `nothing said the file was being read: ${onTrack.join(", ")}`
      );
      await dropChord(page, "[data-slot=arrangement-drop]", "Of its own", 8);
      await page
        .locator("[data-clip-id]", { hasText: "Of its own" })
        .waitFor({ timeout: 30_000 });
      const ofItsOwn = await seen();
      assert(
        ofItsOwn.some((text) => text.includes("Of its own")),
        `nothing said the file was being read: ${ofItsOwn.join(", ")}`
      );
      assert(
        (await page.locator("[data-slot=arrangement-reading]").count()) === 0,
        "it still says it is reading, with the clip there"
      );
    },
  "ARR-025: with no track left, files dropped under the headers make tracks, and one dropped anywhere else never leaves the page":
    async (browser) => {
      const page = await open(browser);
      // Every track but the main one, which is always there.
      const rows = page.locator('[data-track-id]:not([data-track-id="main"])');
      // Its header's name picks a track, and Delete takes it.
      const total = await rows.count();
      await Array.from({ length: total }).reduce<Promise<void>>(
        async (done) => {
          await done;
          await rows
            .first()
            .locator("[data-slot=timeline-track-header]")
            .click({ position: { x: 60, y: 12 } });
          await page.keyboard.press("Delete");
          await page.waitForTimeout(80);
        },
        Promise.resolve()
      );
      assert((await rows.count()) === 0, "Delete left a track");
      const zone = page.locator("[data-slot=arrangement-drop]");
      await zone.waitFor({ timeout: 3000 });
      const room = await zone.boundingBox();
      assert(
        (room?.height ?? 0) > 100,
        `the empty arrangement drops on ${room?.height} px`
      );
      // Over the line under the arrangement, which takes nothing: a file stays refused rather than opening in the browser.
      const refused = await page.evaluate(() => {
        const target = document.querySelector("[data-slot=resizable-handle]");
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File(["x"], "a.wav", { type: "audio/wav" }));
        const init = { bubbles: true, cancelable: true, dataTransfer };
        return !(
          target?.dispatchEvent(new DragEvent("dragover", init)) ||
          target?.dispatchEvent(new DragEvent("drop", init))
        );
      });
      assert(refused, "a file dropped outside would open in the browser");
      await dropChord(page, "[data-slot=arrangement-drop]", "Dropped take", 2);
      await page
        .locator("[data-clip-id]", { hasText: "Dropped take" })
        .waitFor({ timeout: 30_000 });
      assert((await rows.count()) === 1, "the file did not make its track");
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
      // The track's volume moved by hand, on its mixer channel.
      await page.getByRole("tab", { name: "Mixer" }).click();
      await page.getByRole("slider", { name: "3 Audio volume" }).focus();
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
      // Measured once the picking is let go of: the tracks share the height there is, and it can change.
      await page.keyboard.press("Escape");
      const box = await clip.boundingBox();
      const lane = await page.locator('[data-track="track-2"]').boundingBox();
      assert(box && lane, "the clip and the lane are there");
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
        .locator('[data-track="track-4"]')
        .click({ position: { x: 300, y: 10 } });
      await page.locator("[data-slot=panel-bar]").getByText("2 MIDI").waitFor();
      await page.keyboard.press("ArrowDown");
      await page
        .locator("[data-slot=panel-bar]")
        .getByText("3 Audio")
        .waitFor();
      await page.keyboard.press("ArrowUp");
      await page.locator("[data-slot=panel-bar]").getByText("2 MIDI").waitFor();
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
  "ARR-024: a range too narrow for its handles keeps them apart inside it, shows its true length, and follows the pointer":
    async (browser) => {
      const page = await open(browser);
      const range = page.locator("[data-slot=timeline-range]").first();
      const handles = range.locator("[data-slot=timeline-range-handle]");
      const extent = range.locator("[data-slot=timeline-range-extent]");
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
      await zoom("Meta+Equal");
      await page.waitForTimeout(200);
      assert(
        !(await extent.isVisible()),
        "a range as wide as it is long still shows its length apart"
      );
      // Zoomed in, the grid lets it down to a bar; zoomed back out, that is a sliver.
      await page.getByRole("slider", { exact: true, name: "Loop" }).focus();
      await page.keyboard.press("Meta+ArrowDown");
      await page.keyboard.press("Meta+ArrowDown");
      await page
        .locator("[data-slot=timeline-viewport]")
        .first()
        .click({
          position: { x: 700, y: 300 },
        });
      await zoom("Meta+Minus");
      await page.waitForTimeout(200);
      const drawn = await range.boundingBox();
      const line = await extent.boundingBox();
      assert((line?.width ?? 99) < 20, `its length shows ${line?.width} px`);
      assert((drawn?.width ?? 0) >= 32, `it is drawn ${drawn?.width} px wide`);
      const [start, end] = [await box(0), await box(1)];
      assert(
        end.x - (start.x + start.width) >= 4,
        `the handles are ${end.x - (start.x + start.width)} px apart`
      );
      assert(
        start.x >= (drawn?.x ?? 0) &&
          end.x + end.width <= (drawn?.x ?? 0) + (drawn?.width ?? 0),
        "a handle is outside the range"
      );
      await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        end.x + end.width / 2 + 90,
        end.y + end.height / 2,
        {
          steps: 5,
        }
      );
      await page.mouse.up();
      await page.waitForTimeout(100);
      const moved = await box(1);
      const stayed = await box(0);
      assert(
        Math.abs(moved.x - (end.x + 90)) < 30,
        `dragged 90 px, the handle moved ${moved.x - end.x} px`
      );
      assert(
        Math.abs(stayed.x - start.x) < 1,
        "the end handle moved the start"
      );
    },
  "ARR-016: a locator's menu loops from it to the next one, and turns the loop on":
    async (browser) => {
      const page = await open(browser);
      await page.keyboard.press("KeyM");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("KeyM");
      const first = page.locator("[data-slot=timeline-locator]").first();
      await first.waitFor({ timeout: 5000 });
      assert(
        (await page.locator("[data-slot=timeline-locator]").count()) >= 2,
        "two locators were not added"
      );
      const loop = page.getByRole("slider", { exact: true, name: "Loop" });
      const looping = page
        .getByRole("button", { exact: true, name: "Loop" })
        .first();
      // The loop off first, so the menu is what turns it on.
      if ((await looping.getAttribute("aria-pressed")) === "true") {
        await looping.click();
      }
      const before = await loop.getAttribute("aria-valuetext");
      await first.click({ button: "right" });
      await page
        .getByRole("menuitem", { name: "Loop to the next locator" })
        .click();
      await page.waitForTimeout(150);
      const after = await loop.getAttribute("aria-valuetext");
      assert(after !== before, `the loop stayed ${before}`);
      assert(
        (await looping.getAttribute("aria-pressed")) === "true",
        "the loop is not on"
      );
    },
  "ARR-016: the previous and next locator buttons put the cursor on the locators around it":
    async (browser) => {
      const page = await open(browser);
      const offsetOf = (selector: string) =>
        page.evaluate(
          (target) =>
            [...document.querySelectorAll(target)].map((node) =>
              Number(
                (
                  node.closest(
                    "[data-slot=timeline-mark],[data-slot=timeline-playhead]"
                  ) as HTMLElement
                ).style.getPropertyValue("--timeline-offset")
              )
            ),
          selector
        );
      // Two locators, a bar apart, and the cursor back at the start.
      await page.keyboard.press("KeyM");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("KeyM");
      await page.keyboard.press("Home");
      const marks = (await offsetOf("[data-slot=timeline-locator]")).sort(
        (a, b) => a - b
      );
      assert(marks.length >= 2, "two locators were not added");
      const cursor = async () =>
        (await offsetOf("[data-slot=timeline-playhead]"))[0] ?? -1;
      const next = page.getByRole("button", { name: "Next locator" });
      const previous = page.getByRole("button", { name: "Previous locator" });
      await next.click();
      const ahead = marks.find((at) => at > 0) ?? -1;
      assert(
        Math.abs((await cursor()) - ahead) < 1e-6,
        `Next put the cursor at ${await cursor()}, not ${ahead}`
      );
      const last = marks.at(-1) ?? -1;
      await page.keyboard.press("End");
      await previous.click();
      assert(
        (await cursor()) <= last + 1e-6,
        `Previous left the cursor at ${await cursor()}`
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
      // As far as the bar lets it go, 200 px at most: where the earlier drags left the window depends on their timing,
      // and past the bar's end the handle stops there, short of the pointer.
      const wide = () => viewport.evaluate((element) => element.scrollWidth);
      const before = await wide();
      const track = await bar.boundingBox();
      assert(track, "the overview's bar is there");
      const room = track.x + track.width - (held.end.x + held.end.width) - 8;
      const reach = Math.min(200, room);
      assert(reach > 40, `the end handle has ${room} px left to go`);
      await page.mouse.move(
        held.end.x + held.end.width / 2,
        held.end.y + held.end.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(held.end.x + held.end.width / 2 + reach, y, {
        steps: 6,
      });
      await page.mouse.up();
      await page.waitForTimeout(200);
      const after = await wide();
      assert(after < before, `zoomed out from ${before} px to ${after} px`);
      const out = await inBar();
      assert(
        Math.abs(out.end.x - (held.end.x + reach)) <= 2,
        `the end handle is at ${out.end.x}, the pointer at ${held.end.x + reach}`
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
        .getByText("4 Audio", { exact: true })
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
};
