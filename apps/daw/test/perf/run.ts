/**
 * The targets of docs/daw-spec/performance.md, measured in Chromium on the
 * machine it runs on, against the built app: `bun run build`, then
 * `bunx vite preview --port 4173`, then `bun run test:perf`, or name the
 * measures: `bun test/perf/run.ts PRF-003`. `DAW_URL` points at another
 * server. `PERF_SECONDS` is how long the tracks held play (600, as PRF-004
 * asks), `PERF_TRACKS` how many (8,16,32).
 *
 * Times are read off the audio clock: a sound scheduled at a context time is
 * heard at the page time `getOutputTimestamp` maps it to, which counts the
 * output's latency. Audio stays muted.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from "playwright-core";
import { START_SECONDS } from "@/lib/arrangement-engine";
import {
  type LoadSetOptions,
  loadSet,
  stemSet,
  TAKE_SECONDS,
} from "./load-set.ts";

const APP_URL = process.env.DAW_URL ?? "http://localhost:4173/";
const HELD_SECONDS = Number(process.env.PERF_SECONDS ?? 600);
const HELD_TRACKS = (process.env.PERF_TRACKS ?? "8,16,32")
  .split(",")
  .map(Number);
const EXPORT = /Export WAV/;
const SPACES = /\s+/;

/** What a track carries in the sets: an equalizer and a compressor. */
const CHAIN = ["audioui.equalizer", "audioui.compressor"];

/** What the page records, from before its own scripts run. */
interface Probe {
  /** React commits since the count was reset. */
  commits: number;
  /** Every realtime context the page made, in order. */
  contexts: AudioContext[];
  /** Gaps between animation frames while counting, in ms. */
  frames: number[];
  /** When each sound an oscillator started is heard, in page time. */
  heardNotes: number[];
  /** When each play is heard, in page time, once per play. */
  heardPlays: { at: number; heard: number }[];
  /** Page times of the Space keys pressed. */
  keys: number[];
  longTasks: number[];
  /** Page times of the pointer presses. */
  presses: number[];
}

/** Installed before the app: it records, and changes nothing the app does. */
function instrument() {
  const probe: Probe = {
    commits: 0,
    contexts: [],
    frames: [],
    heardNotes: [],
    heardPlays: [],
    keys: [],
    longTasks: [],
    presses: [],
  };
  (window as unknown as { probe: Probe }).probe = probe;
  const heard = (context: BaseAudioContext, when: number) => {
    const realtime = context as AudioContext;
    const stamp = realtime.getOutputTimestamp();
    const at = Math.max(when, realtime.currentTime);
    return (
      (stamp.performanceTime ?? 0) + (at - (stamp.contextTime ?? 0)) * 1000
    );
  };
  const Native = window.AudioContext;
  window.AudioContext = class extends Native {
    constructor(options?: AudioContextOptions) {
      super(options);
      probe.contexts.push(this);
    }
  };
  const { start } = OscillatorNode.prototype;
  OscillatorNode.prototype.start = function (this: OscillatorNode, when = 0) {
    if (this.context instanceof Native) {
      probe.heardNotes.push(heard(this.context, when));
    }
    start.call(this, when);
  };
  const post = MessagePort.prototype.postMessage;
  MessagePort.prototype.postMessage = function (
    this: MessagePort,
    message: unknown,
    ...rest: [StructuredSerializeOptions?]
  ) {
    const sent = (message ?? {}) as {
      state?: { at: number; playing: boolean };
      type?: string;
    };
    const context = probe.contexts.at(-1);
    if (
      context &&
      sent.type === "state" &&
      sent.state?.playing &&
      probe.heardPlays.at(-1)?.at !== sent.state.at
    ) {
      probe.heardPlays.push({
        at: sent.state.at,
        heard: heard(context, sent.state.at / context.sampleRate),
      });
    }
    post.call(this, message, ...rest);
  } as typeof post;
  window.addEventListener(
    "pointerdown",
    (event) => probe.presses.push(event.timeStamp),
    { capture: true }
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.code === "Space") {
        probe.keys.push(event.timeStamp);
      }
    },
    { capture: true }
  );
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      probe.longTasks.push(entry.duration);
    }
  }).observe({ type: "longtask" });
  (
    window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown }
  ).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    checkDCE() {
      // Nothing to check.
    },
    inject: () => 1,
    isDisabled: false,
    onCommitFiberRoot() {
      probe.commits += 1;
    },
    onCommitFiberUnmount() {
      // Nothing to count.
    },
    onPostCommitFiberRoot() {
      // Nothing to count.
    },
    renderers: new Map(),
    supportsFiber: true,
  };
}

/** Runs `pick` on the page's probe: it must use nothing of the harness. */
const read = <T>(page: Page, pick: (probe: Probe) => T) =>
  page.evaluate(`(${pick.toString()})(window.probe)`) as Promise<T>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
};
const ms = (value: number) => `${value.toFixed(1)} ms`;

async function open(browser: Browser | BrowserContext) {
  // A browser opens a context of its own, which keeps its storage in memory; a context given is used as it is.
  const context =
    "newContext" in browser
      ? await browser.newContext({
          acceptDownloads: true,
          viewport: { height: 1000, width: 1440 },
        })
      : browser;
  await context.addInitScript(instrument);
  const page = await context.newPage();
  await page.goto(APP_URL);
  await page.waitForSelector("[data-track-id]", { timeout: 60_000 });
  return page;
}

/** Wakes the audio with a press on the engine line, where a press does nothing else. */
async function wake(page: Page) {
  await page.getByText("kHz").click();
  await page.waitForFunction(
    () =>
      (window as unknown as { probe: Probe }).probe.contexts.at(-1)?.state ===
      "running"
  );
  await page.waitForTimeout(300);
}

/** The engine's output latency: what its context says it adds, in ms. */
const outputLatency = (page: Page) =>
  read(page, (probe) => {
    const context = probe.contexts.at(-1);
    return context
      ? (context.baseLatency + context.outputLatency) * 1000
      : Number.NaN;
  });

/** Opens the app on a generated set, kept in the browser as a project of the user's would be. */
async function openSet(browser: Browser, options: LoadSetOptions) {
  const page = await open(browser);
  // The new project's own save has run, so it will not write over the set.
  await page.waitForTimeout(1200);
  await page.evaluate(
    async ({ json, seconds }) => {
      const rate = 48_000;
      const frames = rate * seconds;
      const data = new DataView(new ArrayBuffer(44 + frames * 4));
      const text = (at: number, value: string) => {
        for (let index = 0; index < value.length; index += 1) {
          data.setUint8(at + index, value.charCodeAt(index));
        }
      };
      text(0, "RIFF");
      data.setUint32(4, 36 + frames * 4, true);
      text(8, "WAVE");
      text(12, "fmt ");
      data.setUint32(16, 16, true);
      data.setUint16(20, 1, true);
      data.setUint16(22, 2, true);
      data.setUint32(24, rate, true);
      data.setUint32(28, rate * 4, true);
      data.setUint16(32, 4, true);
      data.setUint16(34, 16, true);
      text(36, "data");
      data.setUint32(40, frames * 4, true);
      // A chord that swells and fades, with a little noise: a compressor has work to do.
      for (let index = 0; index < frames; index += 1) {
        const time = index / rate;
        const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * time);
        for (let channel = 0; channel < 2; channel += 1) {
          const value =
            swell *
              0.15 *
              (Math.sin(2 * Math.PI * (220 + channel) * time) +
                Math.sin(2 * Math.PI * 277.18 * time) +
                Math.sin(2 * Math.PI * 329.63 * time)) +
            0.02 * (Math.random() * 2 - 1);
          data.setInt16(
            44 + index * 4 + channel * 2,
            Math.max(-1, Math.min(1, value)) * 0x7f_ff,
            true
          );
        }
      }
      const root = await navigator.storage.getDirectory();
      const write = async (
        folder: FileSystemDirectoryHandle,
        name: string,
        bytes: ArrayBuffer | string
      ) => {
        const writable = await (
          await folder.getFileHandle(name, { create: true })
        ).createWritable();
        await writable.write(bytes);
        await writable.close();
      };
      const recordings = await root.getDirectoryHandle("recordings", {
        create: true,
      });
      await write(recordings, "take", data.buffer);
      await write(root, "project.json", json);
    },
    { json: JSON.stringify(loadSet(options)), seconds: TAKE_SECONDS }
  );
  await page.reload();
  await page.waitForSelector(`[data-track="track-${options.tracks}"]`, {
    timeout: 60_000,
  });
  await wake(page);
  return page;
}

/**
 * Opens the app on the user's longest set: `tracks` stems of `seconds`, their
 * recordings written straight into the cache the engine streams from, as a
 * project opened again finds them.
 */
async function openStems(
  context: BrowserContext,
  tracks: number,
  seconds: number
) {
  const page = await open(context);
  await page.waitForTimeout(1200);
  await page.evaluate(
    async ({ count, json, length }) => {
      const rate = 48_000;
      const frames = rate * length;
      const root = await navigator.storage.getDirectory();
      const cache = await root.getDirectoryHandle("cache", { create: true });
      const write = async (
        folder: FileSystemDirectoryHandle,
        name: string,
        chunks: (ArrayBuffer | string)[]
      ) => {
        const writable = await (
          await folder.getFileHandle(name, { create: true })
        ).createWritable();
        await chunks.reduce(async (done, chunk) => {
          await done;
          await writable.write(chunk);
        }, Promise.resolve());
        await writable.close();
      };
      // Ten seconds of a chord, written again and again: what is read matters, not what it sounds like.
      const piece = Float32Array.from(
        { length: rate * 10 },
        (_, index) => 0.2 * Math.sin((2 * Math.PI * 220 * index) / rate)
      );
      const channel = Array.from(
        { length: Math.ceil(frames / piece.length) },
        (_, index) =>
          piece.slice(0, Math.min(piece.length, frames - index * piece.length))
            .buffer as ArrayBuffer
      );
      await Array.from({ length: count }, (_, index) => index + 1).reduce(
        async (done, stem) => {
          await done;
          await write(cache, `rec-${stem}.f32`, [...channel, ...channel]);
          await write(cache, `rec-${stem}.json`, [
            JSON.stringify({
              channels: 2,
              length: frames,
              peaks: [],
              sampleRate: rate,
            }),
          ]);
        },
        Promise.resolve()
      );
      await write(root, "project.json", [json]);
    },
    {
      count: tracks,
      json: JSON.stringify(stemSet({ seconds, tracks })),
      length: seconds,
    }
  );
  await page.reload();
  await page.waitForSelector(`[data-track="track-${tracks}"]`, {
    timeout: 120_000,
  });
  await wake(page);
  return page;
}

/**
 * What the tab holds in memory, in MB: the resident memory of the largest
 * renderer process of the browser started on `profile`, as the system counts
 * it, shared memory and the audio's pages included.
 */
async function tabMemory(profile: string): Promise<number> {
  const rows = (await Bun.$`ps -axo pid=,ppid=,rss=,command=`.text())
    .split("\n")
    .map((line) => line.trim().split(SPACES))
    .map(([pid, ppid, rss, ...command]) => ({
      command: command.join(" "),
      pid: Number(pid),
      ppid: Number(ppid),
      rss: Number(rss),
    }));
  const parent = rows.find(
    (row) =>
      row.command.includes(`--user-data-dir=${profile}`) &&
      !row.command.includes("--type=")
  );
  const renderers = rows.filter(
    (row) => row.ppid === parent?.pid && row.command.includes("--type=renderer")
  );
  return Math.max(0, ...renderers.map((row) => row.rss)) / 1024;
}

/** Reads the browser's render load of the page's audio, through the DevTools protocol. */
async function loadMeter(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const contexts: string[] = [];
  cdp.on("WebAudio.contextCreated", ({ context }) => {
    if (context.contextType === "realtime") {
      contexts.push(context.contextId);
    }
  });
  await cdp.send("WebAudio.enable");
  await page.waitForTimeout(200);
  return async () => {
    const id = contexts.at(-1);
    assert(id, "the protocol reports the page's audio context");
    const { realtimeData } = await cdp.send("WebAudio.getRealtimeData", {
      contextId: id,
    });
    return realtimeData.renderCapacity;
  };
}

/** How many times the output has fallen behind, as the browser counts it. */
const underruns = (page: Page) =>
  read(
    page,
    (probe) =>
      (
        probe.contexts.at(-1) as unknown as {
          playbackStats?: { underrunEvents: number };
        }
      ).playbackStats?.underrunEvents ?? 0
  );

/** Runs `step` `times` times, each once the last is done: a measure is presses in a row. */
const inTurn = <T>(times: number, step: (index: number) => Promise<T>) =>
  Array.from({ length: times }, (_, index) => index).reduce<Promise<T[]>>(
    async (done, index) => [...(await done), await step(index)],
    Promise.resolve([])
  );

const measures: Record<string, (browser: Browser) => Promise<string[]>> = {
  "PRF-001: the engine's output latency": async (browser) => {
    const page = await open(browser);
    await wake(page);
    const latency = await outputLatency(page);
    const { base, output, rate } = await read(page, (probe) => {
      const context = probe.contexts.at(-1) as AudioContext;
      return {
        base: context.baseLatency * 1000,
        output: context.outputLatency * 1000,
        rate: context.sampleRate,
      };
    });
    return [
      `${ms(latency)} (base ${ms(base)}, output ${ms(output)}) at ${rate} Hz, the default output`,
    ];
  },

  "PRF-002: from a key of the piano roll to its note": async (browser) => {
    const page = await open(browser);
    await wake(page);
    const lane = await page.locator('[data-track="track-3"]').boundingBox();
    assert(lane, "the MIDI lane is there");
    await page.mouse.dblclick(lane.x + 4, lane.y + lane.height / 2);
    const key = page
      .locator("[data-slot=piano-roll-keys] [data-color=white]")
      .nth(8);
    await key.scrollIntoViewIfNeeded();
    const box = await key.boundingBox();
    assert(box, "a key of the roll is there");
    const delays = (
      await inTurn(20, async () => {
        const before = await read(page, (probe) => probe.heardNotes.length);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(120);
        await page.mouse.up();
        // The note's release, so the next press starts a voice of its own.
        await page.waitForTimeout(500);
        const { heard, pressed } = await read(page, (probe) => ({
          heard: probe.heardNotes,
          pressed: probe.presses.at(-1) ?? 0,
        }));
        const note = heard[before];
        return note === undefined ? null : note - pressed;
      })
    ).filter((delay) => delay !== null);
    assert(delays.length >= 15, `${delays.length} notes for 20 presses`);
    const latency = await outputLatency(page);
    const worst = Math.max(...delays);
    assert(
      worst <= latency * 1.5,
      `a key sounded ${ms(worst)} after its press, over 1.5 times the output latency (${ms(latency * 1.5)})`
    );
    return [
      `median ${ms(median(delays))}, worst ${ms(worst)} over ${delays.length} presses; target ${ms(latency * 1.5)}`,
    ];
  },

  "PRF-003: from Play to the arrangement at the output, 32 tracks loaded":
    async (browser) => {
      const page = await openSet(browser, {
        devices: CHAIN,
        seconds: 60,
        tracks: 32,
      });
      const delays = (
        await inTurn(15, async () => {
          const before = await read(page, (probe) => probe.heardPlays.length);
          await page.keyboard.press("Space");
          await page.waitForTimeout(300);
          const { heard, pressed } = await read(page, (probe) => ({
            heard: probe.heardPlays,
            pressed: probe.keys.at(-1) ?? 0,
          }));
          await page.keyboard.press("Space");
          await page.waitForTimeout(250);
          const started = heard[before];
          return started ? started.heard - pressed : null;
        })
      ).filter((delay) => delay !== null);
      assert(delays.length === 15, `${delays.length} plays heard of 15`);
      const latency = await outputLatency(page);
      const worst = Math.max(...delays);
      assert(
        worst <= latency + 20,
        `the arrangement reached the output ${ms(worst)} after Play (median ${ms(median(delays))}), over the output latency and 20 ms (${ms(latency + 20)})`
      );
      // The lead a play takes is enough: playing, a message reaches a worklet well before it runs out.
      await page.keyboard.press("Space");
      const late = await page.evaluate(async () => {
        const { probe } = window as unknown as { probe: Probe };
        const context = probe.contexts.at(-1) as AudioContext;
        const code = `registerProcessor("echo", class extends AudioWorkletProcessor {
        constructor() { super(); this.port.onmessage = (event) => this.port.postMessage(currentFrame - event.data); }
        process() { return true; }
      });`;
        await context.audioWorklet.addModule(
          URL.createObjectURL(new Blob([code], { type: "text/javascript" }))
        );
        const echo = new AudioWorkletNode(context, "echo");
        echo.connect(context.destination);
        const frames: number[] = [];
        echo.port.onmessage = (event) => frames.push(event.data);
        const send = async (left: number): Promise<void> => {
          if (left > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, 5 + Math.random() * 20)
            );
            // The frame the engine schedules from, as its clock reads it.
            echo.port.postMessage(
              Math.ceil(context.currentTime * context.sampleRate)
            );
            await send(left - 1);
          }
        };
        await send(200);
        await new Promise((resolve) => setTimeout(resolve, 200));
        echo.disconnect();
        return (Math.max(...frames) / context.sampleRate) * 1000;
      });
      await page.keyboard.press("Space");
      assert(
        late * 2 <= START_SECONDS * 1000,
        `a message reached a worklet ${ms(late)} after the frame it was sent at: less than twice that ahead, a play is cut short`
      );
      return [
        `median ${ms(median(delays))}, worst ${ms(worst)} over ${delays.length} plays; target ${ms(latency + 20)}`,
        `a message reaches a worklet ${ms(late)} at worst after the frame it is sent at; a play is scheduled ${ms(START_SECONDS * 1000)} ahead`,
      ];
    },

  "PRF-004: tracks held through an equalizer and a compressor each": async (
    browser
  ) => {
    const held = await inTurn(HELD_TRACKS.length, async (index) => {
      const tracks = HELD_TRACKS[index] ?? 0;
      const page = await openSet(browser, {
        devices: CHAIN,
        looping: true,
        seconds: 60,
        tracks,
      });
      const load = await loadMeter(page);
      const before = await underruns(page);
      await page.keyboard.press("Space");
      await page.waitForTimeout(1000);
      const loads = await inTurn(HELD_SECONDS, async () => {
        await page.waitForTimeout(1000);
        return load();
      });
      const fellBehind = (await underruns(page)) - before;
      await page.keyboard.press("Space");
      await page.context().close();
      const peak = Math.max(...loads);
      const mean = loads.reduce((sum, value) => sum + value, 0) / loads.length;
      return {
        line: `${tracks} tracks: load peak ${(peak * 100).toFixed(0)} %, mean ${(mean * 100).toFixed(0)} % over ${HELD_SECONDS} s; ${fellBehind} underruns`,
        ok: peak < 0.8 && fellBehind === 0,
      };
    });
    const lines = held.map((result) => result.line);
    assert(
      held.every((result) => result.ok),
      `a set went over 80 % or fell behind: ${lines.join("; ")}`
    );
    return lines;
  },

  "PRF-005: export of the reference arrangement": async (browser) => {
    const page = await openSet(browser, {
      devices: CHAIN,
      returns: ["audioui.reverb", "audioui.delay"],
      seconds: 180,
      tracks: 16,
    });
    const download = page.waitForEvent("download", { timeout: 600_000 });
    const started = performance.now();
    await page.getByRole("button", { name: "More controls" }).click();
    await page.getByRole("menuitem", { name: EXPORT }).click();
    await download;
    const seconds = (performance.now() - started) / 1000;
    return [
      `16 tracks of 3 minutes, two returns: ${seconds.toFixed(1)} s from Export to the file, ${(180 / seconds).toFixed(1)} times real time`,
    ];
  },

  "PRF-006: the user's longest set, 17 stems of 11 min 48 s, streamed":
    async () => {
      const seconds = 708;
      // A profile on disk, as a user's is: a context of the test keeps its storage in memory, too small for 4.6 GB.
      const profile = await mkdtemp(`${tmpdir()}/audio-ui-perf-`);
      const context = await chromium.launchPersistentContext(profile, {
        viewport: { height: 1000, width: 1440 },
      });
      const page = await openStems(context, 17, seconds);
      const before = await underruns(page);
      const opened = await tabMemory(profile);
      await page.keyboard.press("Space");
      await page.waitForTimeout(30_000);
      const playing = await tabMemory(profile);
      const fellBehind = (await underruns(page)) - before;
      await page.keyboard.press("Space");
      // A play from the middle, which no page was loaded for until the cursor got there.
      const lane = await page.locator('[data-track="track-1"]').boundingBox();
      assert(lane, "the first stem is there");
      await page.mouse.click(lane.x + lane.width / 2, lane.y + lane.height / 2);
      await page.waitForTimeout(500);
      await page.keyboard.press("Space");
      await page.waitForTimeout(10_000);
      const jumped = await tabMemory(profile);
      const after = (await underruns(page)) - before;
      await page.keyboard.press("Space");
      await context.close();
      await rm(profile, { force: true, recursive: true });
      const most = Math.max(opened, playing, jumped);
      const line = `17 stems of ${seconds} s (4.6 GB decoded): the page holds ${opened.toFixed(0)} MB opened, ${playing.toFixed(0)} MB after 30 s of playback, ${jumped.toFixed(0)} MB after a play from the middle; ${fellBehind} underruns playing, ${after} in all`;
      assert(most < 1536 && after === 0, line);
      return [line];
    },

  "PRF-007: the interface while 16 tracks play": async (browser) => {
    const page = await openSet(browser, {
      devices: CHAIN,
      looping: true,
      seconds: 60,
      tracks: 16,
    });
    await page.keyboard.press("Space");
    await page.waitForTimeout(2000);
    await read(page, (probe) => {
      probe.commits = 0;
      probe.longTasks = [];
      probe.frames = [];
      let last = performance.now();
      const frame = (now: number) => {
        probe.frames.push(now - last);
        last = now;
        if (probe.frames.length < 3600) {
          requestAnimationFrame(frame);
        }
      };
      requestAnimationFrame(frame);
      return 0;
    });
    const seconds = 30;
    await page.waitForTimeout(seconds * 1000);
    const { commits, frames, longTasks } = await read(page, (probe) => ({
      commits: probe.commits,
      frames: probe.frames,
      longTasks: probe.longTasks,
    }));
    await page.keyboard.press("Space");
    const longest = Math.max(0, ...longTasks);
    const rate = frames.length / seconds;
    assert(
      longest <= 50,
      `a task took ${ms(longest)} while the tracks played (${longTasks.length} over 50 ms)`
    );
    return [
      `${longTasks.length} long tasks (longest ${ms(longest)}), ${(commits / seconds).toFixed(1)} React commits a second, ${rate.toFixed(0)} frames a second (longest gap ${ms(Math.max(...frames))}) over ${seconds} s`,
    ];
  },
};

const wanted = process.argv.slice(2);
const chosen = Object.entries(measures).filter(
  ([name]) => wanted.length === 0 || wanted.some((word) => name.includes(word))
);
const launched = await chromium.launch();
const passed = await inTurn(chosen.length, async (index) => {
  const [name, measure] = chosen[index] ?? ["", async () => []];
  try {
    const lines = await measure(launched);
    console.log(
      [`  pass ${name}`, ...lines.map((line) => `       ${line}`)].join("\n")
    );
    return true;
  } catch (error) {
    console.log(`  FAIL ${name}\n       ${(error as Error).message}`);
    return false;
  }
});
await launched.close();
const failed = passed.filter((pass) => !pass).length;
console.log(failed ? `\n${failed} failed.` : "\nAll measures pass.");
process.exit(failed ? 1 : 0);
