/** The checks of docs/daw-spec/audio-clips.md. */
import encode from "@audio/encode";
import {
  assert,
  type Checks,
  dropChord,
  dropFiles,
  loudest,
  open,
  showMixer,
} from "../helpers";

/** The clip view's View menu, and two of its views. */
const VIEW_MENU = /^View:/;
const SPECTROGRAM_VIEW = /^Spectrogram\s*Octaves/;
const BAND_VIEW = /^Waveform, by band/;

export const checks: Checks = {
  "CLP-019: with Warp files on import on, a dropped groove comes in warped in Beats at its tempo":
    async (browser) => {
      const page = await open(browser, undefined, { warpOnImport: true });
      // Sixteen seconds of a kick and a snare at 100 BPM, from a quarter of a second in.
      const rate = 48_000;
      const groove = new Float32Array(16 * rate);
      let seed = 3;
      for (let beat = 0; 0.25 + beat * 0.6 < 16; beat += 1) {
        const from = Math.round((0.25 + beat * 0.6) * rate);
        for (
          let frame = 0;
          frame < 0.2 * rate && from + frame < groove.length;
          frame += 1
        ) {
          seed = (seed * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
          const sound =
            beat % 2 === 0
              ? 0.9 * Math.sin((2 * Math.PI * 55 * frame) / rate)
              : 0.5 * ((seed / 0x7f_ff_ff_ff) * 2 - 1);
          groove[from + frame] = sound * Math.exp((-frame / rate) * 20);
        }
      }
      await dropFiles(page, '[data-track="track-1"]', [
        {
          bytes: await encode.wav([groove, groove], { sampleRate: rate }),
          name: "Groove.wav",
          type: "audio/wav",
        },
      ]);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 20_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const modes = page.getByRole("group", { name: "Warp mode" });
      await modes.waitFor({ timeout: 5000 });
      assert(
        (await modes
          .getByRole("button", { exact: true, name: "Beats" })
          .getAttribute("aria-pressed")) === "true",
        "the groove did not come in in Beats"
      );
      // Read whatever the browser's language writes as the decimal mark.
      const tempo = Number(
        (await page.getByLabel("Source tempo").inputValue()).replace(",", ".")
      );
      assert(Math.abs(tempo - 100) < 0.1, `read at ${tempo} BPM, not 100`);
    },
  "CLP-006: a file dropped fades 4 ms at its edges, and Delete on a longer fade brings it back to 4 ms":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      await page.waitForSelector("[data-clip-id]", { timeout: 10_000 });
      const fade = page.getByRole("slider", { name: "Take fade in" });
      const value = () => fade.inputValue().then(Number);
      assert(
        Math.abs((await value()) - 0.004) < 1e-6,
        `a file dropped fades in over ${await value()} s`
      );
      await fade.focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        () =>
          Number(
            (
              document.querySelector(
                '[aria-label="Take fade in"]'
              ) as HTMLInputElement | null
            )?.value
          ) > 0.004
      );
      await page.keyboard.press("Delete");
      await page.waitForFunction(
        () =>
          Math.abs(
            Number(
              (
                document.querySelector(
                  '[aria-label="Take fade in"]'
                ) as HTMLInputElement | null
              )?.value
            ) - 0.004
          ) < 1e-6,
        undefined,
        { timeout: 5000 }
      );
      assert(
        (await page.locator("[data-clip-id]").count()) === 1,
        "Delete on a fade took the clip away too"
      );
    },
  "CLP-015: Warp in the clip panel keeps the pitch, in Beats, and the panel picks another mode; the clip still plays":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const modes = page.getByRole("group", { name: "Warp mode" });
      await modes.waitFor({ timeout: 5000 });
      const pressed = (name: string) =>
        modes
          .getByRole("button", { exact: true, name })
          .getAttribute("aria-pressed");
      assert(
        (await pressed("Repitch")) === "true",
        "a new clip starts in Repitch"
      );
      await page.getByRole("button", { exact: true, name: "Warp" }).click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Warp mode"]')
            ?.querySelectorAll('[aria-pressed="true"]')[0]?.textContent ===
          "Beats",
        undefined,
        { timeout: 5000 }
      );
      await modes.getByRole("button", { exact: true, name: "Tones" }).click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Warp mode"]')
            ?.querySelectorAll('[aria-pressed="true"]')[0]?.textContent ===
          "Tones",
        undefined,
        { timeout: 5000 }
      );
      await showMixer(page);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");
      const level = await loudest(page, 1500);
      await page.keyboard.press("Space");
      assert(level > -40, `the clip in Tones plays at ${level} dB`);
    },
  "CLP-020: zoomed in, a clip's waveform is solid and no wider than the view, a column per pixel":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, "[data-add-track]", "Long take", 20);
      // On the canvas or the GPU, whichever draws it.
      const canvas = page
        .locator("[data-slot^=timeline-clip-waveform]")
        .first();
      await canvas.waitFor({ timeout: 30_000 });
      await [1, 2, 3, 4, 5].reduce(async (done) => {
        await done;
        await page.keyboard.press("Meta+Equal");
        await page.waitForTimeout(60);
      }, Promise.resolve());
      await page.waitForTimeout(400);
      const read = await canvas.evaluate((element) => {
        const drawn = element as HTMLCanvasElement;
        const clip = drawn.parentElement?.getBoundingClientRect();
        const view = drawn
          .closest("[data-slot=timeline-viewport]")
          ?.getBoundingClientRect();
        // A column is empty with no ink from top to bottom: a stereo clip is drawn a row a channel, with a line of ground between them.
        const pixels = drawn
          .getContext("2d")
          ?.getImageData(0, 0, drawn.width, drawn.height).data;
        let empty = 0;
        for (let column = 0; column < drawn.width; column += 1) {
          let inked = false;
          for (let row = 0; row < drawn.height && !inked; row += 1) {
            inked = Boolean(pixels?.[(row * drawn.width + column) * 4 + 3]);
          }
          if (!inked) {
            empty += 1;
          }
        }
        return {
          clip: clip?.width ?? 0,
          columns: drawn.width,
          empty,
          scale: window.devicePixelRatio,
          shown: drawn.getBoundingClientRect().width,
          view: view?.width ?? 0,
        };
      });
      assert(
        read.clip > read.shown,
        `a clip of ${read.clip} px draws ${read.shown} px`
      );
      assert(
        read.shown <= read.view + 1024,
        `${read.shown} px drawn in a view of ${read.view} px`
      );
      assert(
        Math.abs(read.columns - read.shown * read.scale) < 2,
        `${read.columns} columns over ${read.shown} px`
      );
      assert(
        read.empty === 0,
        `${read.empty} of ${read.columns} columns are gaps`
      );
    },
  "CLP-020: the clip view's waveform is solid too, a column per pixel": async (
    browser
  ) => {
    const page = await open(browser);
    await dropChord(page, '[data-track="track-1"]', "Take", 4);
    const clip = page.locator("[data-clip-id]").first();
    await clip.waitFor({ timeout: 10_000 });
    await clip.click();
    await page.getByRole("tab", { name: "Clip" }).click();
    const canvas = page.locator("[data-slot=clip-panel-source] canvas");
    await canvas.waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    const read = await canvas.evaluate((element) => {
      const drawn = element as HTMLCanvasElement;
      // Copied to a 2D canvas, so a waveform on the GPU reads as one on the canvas does.
      const copy = document.createElement("canvas");
      copy.width = drawn.width;
      copy.height = drawn.height;
      const context = copy.getContext("2d");
      context?.drawImage(drawn, 0, 0);
      // A column is empty with no ink from top to bottom: a stereo source is drawn a row a channel, with a line of ground between them.
      const pixels = context?.getImageData(
        0,
        0,
        drawn.width,
        drawn.height
      ).data;
      let empty = 0;
      for (let column = 0; column < drawn.width; column += 1) {
        let inked = false;
        for (let row = 0; row < drawn.height && !inked; row += 1) {
          inked = Boolean(pixels?.[(row * drawn.width + column) * 4 + 3]);
        }
        if (!inked) {
          empty += 1;
        }
      }
      return { columns: drawn.width, empty };
    });
    assert(read.columns > 0, "the waveform has no columns");
    assert(
      read.empty === 0,
      `${read.empty} of ${read.columns} columns are gaps`
    );
  },
  "CLP-020: the clip view's waveform follows a zoom as it goes, not once it stops":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 20);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const source = page.locator("[data-slot=clip-panel-source]");
      await source.locator("canvas").waitFor({ timeout: 5000 });
      await page.waitForTimeout(400);
      const box = await source.boundingBox();
      await page.mouse.move(
        (box?.x ?? 0) + (box?.width ?? 0) / 2,
        (box?.y ?? 0) + (box?.height ?? 0) / 2
      );
      const drawn = () =>
        source.locator("canvas").evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          return canvas.width > 0
            ? canvas.toDataURL()
            : `${canvas.width}x${canvas.height}`;
        });
      const before = await drawn();
      await page.keyboard.down("Control");
      await [1, 2, 3, 4, 5, 6, 7, 8].reduce(async (done) => {
        await done;
        await page.mouse.wheel(0, -120);
      }, Promise.resolve());
      // In the frame after the last step, with no time for anything to catch up.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          })
      );
      const zoomed = await drawn();
      await page.keyboard.up("Control");
      await page.waitForTimeout(500);
      const settled = await drawn();
      assert(zoomed !== before, "the zoom drew nothing");
      assert(zoomed === settled, "the waveform caught up only after the zoom");
    },
  "CLP-021: the clip view dims what the clip leaves out of its source": async (
    browser
  ) => {
    const page = await open(browser);
    await dropChord(page, '[data-track="track-1"]', "Take", 20);
    const clip = page.locator("[data-clip-id]").first();
    await clip.waitFor({ timeout: 10_000 });
    await clip.click();
    await page.getByRole("tab", { name: "Clip" }).click();
    const left = page.locator("[data-slot=clip-panel-unplayed]").first();
    await left.waitFor({ state: "attached", timeout: 5000 });
    const width = async () => (await left.boundingBox())?.width ?? 0;
    assert((await width()) === 0, "a clip playing it all still dims some");
    const handle = page.getByRole("slider", { name: "Clip start" });
    await handle.focus();
    await [1, 2, 3, 4, 5, 6].reduce(async (done) => {
      await done;
      await page.keyboard.press("Shift+ArrowRight");
    }, Promise.resolve());
    await page.waitForTimeout(100);
    assert((await width()) > 0, "the stretch before the start is not dimmed");
  },
  "CLP-022: a clip box folds from anywhere on its heading, and unfolds from anywhere on its strip":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const box = page.locator("[data-slot=clip-box]", { hasText: "Loop" });
      // Its title, not its caret: the press lands on the button stretched over the heading.
      const title = await box
        .getByRole("heading", { name: "Loop" })
        .boundingBox();
      await page.mouse.click(
        (title?.x ?? 0) + 4,
        (title?.y ?? 0) + (title?.height ?? 0) / 2
      );
      await page.getByRole("button", { name: "Unfold Loop" }).waitFor();
      const strip = await box.boundingBox();
      assert(strip && strip.width < 48, "the box did not fold to a strip");
      await page.mouse.click(
        (strip?.x ?? 0) + (strip?.width ?? 0) / 2,
        (strip?.y ?? 0) + (strip?.height ?? 0) - 8
      );
      await page.getByRole("button", { name: "Fold Loop" }).waitFor();
    },
  "CLP-023: a clip's fade handles and its fades sit under its name, never over it":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Named take", 4);
      const clip = page.locator("[data-clip-id]", { hasText: "Named take" });
      await clip.waitFor({ timeout: 30_000 });
      await clip.click();
      const header = await clip
        .locator("[data-slot=timeline-clip-header]")
        .boundingBox();
      const fade = await page
        .getByRole("slider", { name: "Named take fade in" })
        .locator("..")
        .boundingBox();
      assert(header && fade, "the header and the handle are there");
      assert(
        (fade?.y ?? 0) >= (header?.y ?? 0) + (header?.height ?? 0),
        `the handle is at ${fade?.y}, the name runs to ${(header?.y ?? 0) + (header?.height ?? 0)}`
      );
      // The fade's line is drawn under the name too: give the fade some length first.
      await page.getByRole("slider", { name: "Named take fade in" }).focus();
      await [1, 2, 3, 4, 5, 6].reduce(async (done) => {
        await done;
        await page.keyboard.press("Shift+ArrowRight");
      }, Promise.resolve());
      const curve = await clip
        .locator("[data-slot=timeline-clip-fade]")
        .first()
        .boundingBox();
      assert(
        (curve?.y ?? 0) >= (header?.y ?? 0) + (header?.height ?? 0) - 1,
        `the fade is drawn from ${curve?.y}, over a name running to ${(header?.y ?? 0) + (header?.height ?? 0)}`
      );
    },
  "CLP-025: a streamed recording's clip view is drawn on the GPU from its leaves, on one canvas, never read whole":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const source = page.locator("[data-slot=clip-panel-source]");
      await source.locator("canvas").first().waitFor({ timeout: 5000 });
      await page.waitForTimeout(1500);
      // Its leaves are kept beside its cache file, and the GPU draws from them, reading only the frames in view zoomed in.
      const kept = await page.evaluate(async () => {
        const folder = await (
          await navigator.storage.getDirectory()
        ).getDirectoryHandle("cache");
        return (await Array.fromAsync(folder.keys())).filter((name) =>
          name.endsWith(".leaves")
        ).length;
      });
      assert(kept > 0, "the streamed recording keeps no leaves");
      assert(
        (await source
          .locator("canvas[data-slot=timeline-clip-waveform-gl]")
          .count()) === 1,
        "the source is not drawn on one GPU canvas"
      );
      assert(
        (await source
          .locator("canvas[data-slot=timeline-clip-waveform]")
          .count()) === 0,
        "the source is drawn on the 2D canvas too"
      );
    },
  "CLP-026: the clip view's View menu draws a streamed source as its spectrogram, from spectra kept beside it, and by band":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const source = page.locator("[data-slot=clip-panel-source]");
      await source.locator("canvas").first().waitFor({ timeout: 5000 });
      const pick = async (name: RegExp) => {
        await page.getByRole("button", { name: VIEW_MENU }).click();
        await page.getByRole("menuitemradio", { name }).click();
      };
      await pick(SPECTROGRAM_VIEW);
      await source
        .locator("canvas[data-slot=timeline-clip-spectrogram]")
        .waitFor({ timeout: 10_000 });
      // The axis takes no width of its own: its labels hang over the lane's edge.
      await page
        .locator("[data-slot=spectrogram-axis]")
        .waitFor({ state: "attached", timeout: 5000 });
      const spectra = async () =>
        await page.evaluate(async () => {
          const folder = await (
            await navigator.storage.getDirectory()
          ).getDirectoryHandle("cache");
          return (await Array.fromAsync(folder.keys())).filter((name) =>
            name.endsWith(".spectra")
          ).length;
        });
      const waited = async (tries: number): Promise<number> => {
        const count = await spectra();
        if (count > 0 || tries === 0) {
          return count;
        }
        await page.waitForTimeout(250);
        return await waited(tries - 1);
      };
      assert(
        (await waited(40)) > 0,
        "the spectrogram's spectra are not kept beside the recording"
      );
      await pick(BAND_VIEW);
      await source
        .locator("canvas[data-slot=timeline-clip-waveform-gl]")
        .waitFor({ timeout: 5000 });
      assert(
        (await page
          .getByRole("button", { name: VIEW_MENU })
          .getAttribute("aria-label")) === "View: Waveform, by band",
        "the View menu does not read the view shown"
      );
    },
  "CLP-027: more audio clips than a browser keeps WebGL contexts all draw on the GPU, on the page's one":
    async (browser) => {
      const page = await open(browser);
      const lost: string[] = [];
      page.on("console", (message) => {
        if (message.text().includes("WebGL contexts")) {
          lost.push(message.text());
        }
      });
      // Eighteen takes, a track each: past the sixteen contexts a browser keeps.
      await Array.from({ length: 18 }).reduce<Promise<unknown>>(
        async (done, _, index) => {
          await done;
          await dropChord(page, "[data-add-track]", `Take ${index + 1}`, 1);
          await page.waitForSelector(
            `[aria-label="Take ${index + 1}"][data-track-id]`,
            { timeout: 10_000 }
          );
        },
        Promise.resolve()
      );
      // A clip out of sight draws nothing until it comes near: each is scrolled into view, and draws there.
      const clips = page.locator(
        "[data-clip-id]:has(canvas[data-slot=timeline-clip-waveform-gl])"
      );
      const total = await clips.count();
      assert(total >= 18, `${total} clips draw on the GPU`);
      const blank = await Array.from({ length: total }).reduce<Promise<number>>(
        async (done, _, index) => {
          const sum = await done;
          const clip = clips.nth(index);
          await clip.scrollIntoViewIfNeeded();
          await page.waitForTimeout(150);
          const detail = await clip
            .locator("canvas[data-slot=timeline-clip-waveform-gl]")
            .getAttribute("data-detail");
          return detail ? sum : sum + 1;
        },
        Promise.resolve(0)
      );
      assert(
        blank === 0,
        `${blank} of ${total} GPU waveforms stayed blank in view`
      );
      assert(lost.length === 0, `a context was lost: ${lost[0]}`);
    },
  "CLP-028: the clip view's Process menu makes a recording of the clip's source, which the clip plays whole, and one undo takes it back":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const width = async () => (await clip.boundingBox())?.width ?? 0;
      const before = await width();
      const cached = async () =>
        await page.evaluate(async () => {
          const folder = await (
            await navigator.storage.getDirectory()
          ).getDirectoryHandle("cache");
          return (await Array.fromAsync(folder.keys())).filter((name) =>
            name.endsWith(".f32")
          ).length;
        });
      const recordings = await cached();
      await page.getByRole("button", { exact: true, name: "Process" }).click();
      await page.getByRole("menuitem", { name: "Repeat" }).click();
      await page.getByRole("menuitem", { name: "2 times" }).click();
      // The clip played its source to the end: it plays the two of it.
      await page.waitForFunction(
        ({ was }) => {
          const box = document
            .querySelector("[data-clip-id]")
            ?.getBoundingClientRect();
          return box !== undefined && Math.abs(box.width - 2 * was) < 2;
        },
        { was: before },
        { timeout: 20_000 }
      );
      assert(
        (await cached()) === recordings + 1,
        "the processed source is not kept as a recording of its own"
      );
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Meta+KeyZ");
      await page.waitForFunction(
        ({ was }) => {
          const box = document
            .querySelector("[data-clip-id]")
            ?.getBoundingClientRect();
          return box !== undefined && Math.abs(box.width - was) < 2;
        },
        { was: before },
        { timeout: 5000 }
      );
    },
  "CLP-029: the clip view edits its sound as an audio editor does: a drag selects, Delete takes it out, Copy and Paste put it back, one undo each":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const sound = page.locator("[data-slot=clip-panel-edit]");
      await sound.waitFor({ timeout: 5000 });
      const width = async () => (await clip.boundingBox())?.width ?? 0;
      const before = await width();
      const settled = async (to: number) =>
        await page.waitForFunction(
          (want) => {
            const box = document
              .querySelector("[data-clip-id]")
              ?.getBoundingClientRect();
            return box !== undefined && Math.abs(box.width - want) < 2;
          },
          to,
          { timeout: 20_000 }
        );
      // A quarter of the sound, from a quarter in, dragged across.
      const box = await sound.boundingBox();
      const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
      const x = (share: number) => (box?.x ?? 0) + (box?.width ?? 0) * share;
      await page.mouse.move(x(0.25), y);
      await page.mouse.down();
      await page.mouse.move(x(0.5), y, { steps: 8 });
      await page.mouse.up();
      assert(
        (
          (await page.locator("[data-slot=clip-panel-pick]").textContent()) ??
          ""
        ).startsWith("Selection"),
        "a drag on the sound selects nothing"
      );
      await page.keyboard.press("Meta+KeyC");
      await page.keyboard.press("Backspace");
      await settled(before * 0.75);
      // The caret at the start, the quarter pasted back: as long as it was.
      await page.mouse.click(x(0.01), y);
      await page.keyboard.press("Meta+KeyV");
      await settled(before);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur()
      );
      await page.keyboard.press("Meta+KeyZ");
      await settled(before * 0.75);
      await page.keyboard.press("Meta+KeyZ");
      await settled(before);
      // A right-click opens the edits and the Process menu.
      await sound.click({ button: "right" });
      for (const name of ["Cut", "Copy", "Paste", "Delete", "Process"]) {
        assert(
          (await page.getByRole("menuitem", { name }).count()) > 0,
          `the right-click menu has no ${name}`
        );
      }
    },
  "CLP-024: the clip view zooms past its peaks into the samples, then a line through them with a dot on each":
    async (browser) => {
      const page = await open(browser);
      await dropChord(page, '[data-track="track-1"]', "Take", 4);
      const clip = page.locator("[data-clip-id]").first();
      await clip.waitFor({ timeout: 10_000 });
      await clip.click();
      await page.getByRole("tab", { name: "Clip" }).click();
      const source = page.locator("[data-slot=clip-panel-source]");
      const canvas = source.locator("canvas");
      await canvas.waitFor({ timeout: 5000 });
      await page.waitForTimeout(400);
      const box = await page
        .locator("[data-slot=clip-panel] [data-slot=timeline-viewport]")
        .boundingBox();
      await page.mouse.move(
        (box?.x ?? 0) + (box?.width ?? 0) / 2,
        (box?.y ?? 0) + (box?.height ?? 0) / 2
      );
      const detail = () => canvas.getAttribute("data-detail");
      const seen = new Set<string | null>([await detail()]);
      // Zoomed in step by step, each step drawn before the next.
      await page.keyboard.down("Control");
      const zoomIn = async (step: number): Promise<void> => {
        if (step >= 160 || seen.has("line")) {
          return;
        }
        await page.mouse.wheel(0, -240);
        await page.waitForTimeout(40);
        seen.add(await detail());
        await zoomIn(step + 1);
      };
      await zoomIn(0);
      await page.keyboard.up("Control");
      await page.waitForTimeout(400);
      // On the GPU a pixel column is the exact lowest and highest of its samples (`columns`), then a line; on the canvas, the peaks come first and the samples between.
      const first = seen.has("columns") ? "columns" : "peaks";
      assert(seen.has(first), `it never drew the ${first}: ${[...seen]}`);
      if (first === "peaks") {
        assert(seen.has("samples"), `it never drew the samples: ${[...seen]}`);
      }
      assert(
        (await detail()) === "line",
        `the closest zoom draws ${await detail()}`
      );
    },
};
