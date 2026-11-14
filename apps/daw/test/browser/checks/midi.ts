/** The checks of docs/daw-spec/midi.md. */
import {
  assert,
  type Checks,
  dropChord,
  dropFiles,
  loudest,
  open,
  showMixer,
} from "../helpers";

const ascii = (value: string) => [...value].map((char) => char.charCodeAt(0));
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
const chunk = (id: string, bytes: number[]) => [
  ...ascii(id),
  ...u32(bytes.length),
  ...bytes,
];
const END = [0, 0xff, 0x2f, 0];

/**
 * A MIDI file of two tracks at 96 ticks a quarter: "Bass", a fingered bass
 * (program 33) playing a C for a bar, and "Drums" on channel 10, a kick on
 * each beat.
 */
const SONG = new Uint8Array([
  ...chunk("MThd", [0, 1, 0, 2, 0, 96]),
  ...chunk("MTrk", [
    0,
    0xff,
    0x03,
    4,
    ...ascii("Bass"),
    0,
    0xc0,
    33,
    0,
    0x90,
    36,
    110,
    // A bar of 384 ticks, as a variable-length quantity.
    0x83,
    0x00,
    0x80,
    36,
    0,
    ...END,
  ]),
  ...chunk("MTrk", [
    0,
    0xff,
    0x03,
    5,
    ...ascii("Drums"),
    ...[0, 96, 192, 288].flatMap((_tick, index) => [
      index === 0 ? 0 : 48,
      0x99,
      36,
      120,
      48,
      0x89,
      36,
      0,
    ]),
    ...END,
  ]),
]);

/** A MusicXML score of one part: a bar of four quarter notes. */
const SCORE = new TextEncoder().encode(`<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Flute</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>
    ${["C", "D", "E", "F"].map((step) => `<note><pitch><step>${step}</step><octave>5</octave></pitch><duration>1</duration></note>`).join("")}
  </measure></part>
</score-partwise>`);

/** The Notes menu's button, its name the word and its caret. */
const NOTES_MENU = /^Notes/;

export const checks: Checks = {
  "MID-008: a MIDI file on the add-track button makes a MIDI track a part, with its instrument; a score on a MIDI track, a clip; on an audio track, a notice":
    async (browser) => {
      const page = await open(browser);
      await dropFiles(page, "[data-add-track]", [
        { bytes: SONG, name: "Song.mid", type: "audio/midi" },
      ]);
      await page.waitForSelector('[aria-label="Bass"][data-track-id]', {
        timeout: 10_000,
      });
      await page.waitForSelector('[aria-label="Drums"][data-track-id]');
      await showMixer(page);
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      const level = await loudest(page, 2000);
      await page.keyboard.press("Space");
      assert(
        level > -50,
        `the imported parts are near silent through their instruments (${level} dB)`
      );
      const onTheLane = page.locator('[data-track="track-3"] [data-clip-id]');
      const before = await onTheLane.count();
      await dropFiles(page, '[data-track="track-3"]', [
        {
          bytes: SCORE,
          name: "Tune.musicxml",
          type: "application/vnd.recordare.musicxml+xml",
        },
      ]);
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('[data-track="track-3"] [data-clip-id]')
            .length > count,
        before,
        { timeout: 5000 }
      );
      await dropFiles(page, '[data-track="track-1"]', [
        { bytes: SONG, name: "Song.mid", type: "audio/midi" },
      ]);
      await page
        .locator("[data-sonner-toast]", { hasText: "goes on a MIDI track" })
        .waitFor({ timeout: 5000 });
    },
  "MID-009: Import MIDI or MusicXML lays a file's parts on new MIDI tracks":
    async (browser) => {
      const page = await open(browser);
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "More controls" }).click();
      await page
        .getByRole("menuitem", { name: "Import MIDI or MusicXML…" })
        .click();
      await (await chooser).setFiles({
        buffer: Buffer.from(SCORE),
        mimeType: "application/vnd.recordare.musicxml+xml",
        name: "Tune.musicxml",
      });
      await page.waitForSelector('[aria-label="Tune"][data-track-id]', {
        timeout: 10_000,
      });
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
  "MID-010: a clip's Scale menu offers the song's likeliest keys, marks the one picked on the roll and its root, and undo takes it back with the clip still open":
    async (browser) => {
      const page = await open(browser);
      const onTheLane = page.locator('[data-track="track-3"] [data-clip-id]');
      const before = await onTheLane.count();
      // C, D, E and F, a bar of quarter notes: a song for the key to be read from.
      await dropFiles(page, '[data-track="track-3"]', [
        {
          bytes: SCORE,
          name: "Tune.musicxml",
          type: "application/vnd.recordare.musicxml+xml",
        },
      ]);
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('[data-track="track-3"] [data-clip-id]')
            .length > count,
        before,
        { timeout: 5000 }
      );
      await onTheLane.last().dblclick();
      const trigger = page.getByRole("button", { name: "Scale: off" });
      await trigger.waitFor({ timeout: 5000 });
      assert(
        (await page.locator("[data-in-scale]").count()) === 0,
        "a clip with its scale off marks rows"
      );
      await trigger.click();
      const detected = page.locator("[data-slot=scale-menu-detect]");
      await detected.getByRole("menuitem").first().waitFor({ timeout: 5000 });
      const keys = await detected.getByRole("menuitem").allTextContents();
      assert(
        keys.length === 3 && keys.includes("C Major"),
        `the menu offers ${keys.join(", ")}`
      );
      // Not the scale a clip starts with: a pick sets it and turns it on, in one step.
      await detected.getByRole("menuitem", { name: "D Minor" }).click();
      await page
        .getByRole("button", { name: "Scale: D Minor" })
        .waitFor({ timeout: 5000 });
      assert(
        (await page.locator("[data-in-scale]").count()) > 0,
        "the scale picked marks no rows"
      );
      assert(
        (await page.locator("[data-scale-root]").count()) > 0 &&
          (await page.locator("[data-out-of-scale]").count()) > 0,
        "the root's rows, or the ones out of the scale, are not marked"
      );
      await page.getByRole("button", { exact: true, name: "Undo" }).click();
      // The clip stays open through the undo, its scale off again.
      await page
        .getByRole("button", { name: "Scale: off" })
        .waitFor({ timeout: 5000 });
    },
  "MID-010: the keys are read from the audio clips too, with no notes": async (
    browser
  ) => {
    const page = await open(browser);
    // A, C sharp and E held for four seconds: an A major chord, on an audio track.
    await dropChord(page, '[data-track="track-1"]', "Chord take");
    await page
      .locator('[data-track="track-1"] [data-clip-id]')
      .first()
      .waitFor({ timeout: 10_000 });
    const lane = await page.locator('[data-track="track-3"]').boundingBox();
    assert(lane, "the MIDI lane is there");
    await page.mouse.dblclick(lane.x + 4, lane.y + lane.height / 2);
    await page.locator("[data-slot=scale-menu-trigger]").click();
    const detected = page.locator("[data-slot=scale-menu-detect]");
    await detected.getByRole("menuitem").first().waitFor({ timeout: 5000 });
    const keys = await detected.getByRole("menuitem").allTextContents();
    assert(
      keys.length === 3 && keys.includes("A Major"),
      `an empty clip beside an A major chord offers ${keys.join(", ")}`
    );
  },
  "MID-011: with the scale on, Notes > Pitch > Up moves the notes a step of the scale, and Fit to scale moves those out of it in":
    async (browser) => {
      const page = await open(browser);
      const onTheLane = page.locator('[data-track="track-3"] [data-clip-id]');
      const before = await onTheLane.count();
      // C5, D5, E5 and F5.
      await dropFiles(page, '[data-track="track-3"]', [
        {
          bytes: SCORE,
          name: "Tune.musicxml",
          type: "application/vnd.recordare.musicxml+xml",
        },
      ]);
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('[data-track="track-3"] [data-clip-id]')
            .length > count,
        before,
        { timeout: 5000 }
      );
      await onTheLane.last().dblclick();
      const pitches = () =>
        page
          .locator(
            '[data-slot="piano-roll-grid"] [role="button"][aria-pressed]'
          )
          .evaluateAll((all) =>
            all
              .map(
                (note) => (note.getAttribute("aria-label") ?? "").split(",")[0]
              )
              .sort()
              .join(" ")
          );
      const scaleMenu = page.locator("[data-slot=scale-menu-trigger]");
      await scaleMenu.click();
      const detected = page.locator("[data-slot=scale-menu-detect]");
      await detected.getByRole("menuitem").first().waitFor({ timeout: 5000 });
      await detected.getByRole("menuitem", { name: "D Minor" }).click();
      // The Notes menu, in the bar over the roll: its commands by what they change.
      const command = async (group: string, name: string) => {
        await page
          .locator("[data-slot=midi-clip-panel-toolbar]")
          .getByRole("button", { name: NOTES_MENU })
          .click();
        await page.getByRole("menuitem", { name: group }).hover();
        await page.getByRole("menuitem", { exact: true, name }).click();
      };
      await command("Pitch", "Up");
      await page.waitForFunction(
        () =>
          [
            ...document.querySelectorAll(
              '[data-slot="piano-roll-grid"] [role="button"][aria-pressed]'
            ),
          ].some((note) => note.getAttribute("aria-label")?.startsWith("G5")),
        undefined,
        { timeout: 5000 }
      );
      assert(
        (await pitches()) === "D5 E5 F5 G5",
        `a step of D minor up gives ${await pitches()}`
      );
      // E minor has F sharp, not F: Fit to scale moves F to E, the lower of two as near.
      await scaleMenu.click();
      await page.getByRole("menuitem", { name: "Root: D" }).hover();
      await page.getByRole("menuitemradio", { exact: true, name: "E" }).click();
      await page.getByRole("button", { name: "Scale: E Minor" }).waitFor({
        timeout: 5000,
      });
      // The menu stays open on a root picked: the trigger closes it (Escape would let go of the clip too).
      if (await page.locator("[data-slot=scale-menu-content]").isVisible()) {
        await scaleMenu.click();
      }
      await command("Pitch", "Fit to scale");
      await page.waitForFunction(
        () =>
          ![
            ...document.querySelectorAll(
              '[data-slot="piano-roll-grid"] [role="button"][aria-pressed]'
            ),
          ].some((note) => note.getAttribute("aria-label")?.startsWith("F5")),
        undefined,
        { timeout: 5000 }
      );
      assert(
        (await pitches()) === "D5 E5 E5 G5",
        `fitted to E minor, the notes are ${await pitches()}`
      );
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
