/**
 * The benches again, in real browsers (Chromium, Firefox, WebKit): a
 * gesture's whole main-thread cost per move (script, style, layout and
 * paint), which happy-dom cannot measure. Run with `bun run bench:browsers`,
 * or name the engines: `bun bench/browsers.ts firefox webkit`.
 */
import { type BrowserType, chromium, firefox, webkit } from "playwright-core";

const FRAME_MS = 1000 / 120;
const WARMUP = 30;
const RUNS = 300;

/** Where the pointer is for move `index`, relative to the target's centre. */
type Path = (index: number) => { x: number; y: number };

const sweep = (index: number, span: number, period = 60) => {
  const phase = (index % period) / period;
  return span * (phase < 0.5 ? phase * 2 : 2 - phase * 2);
};

const gestures: Record<
  string,
  { click?: boolean; label: string; live?: boolean; path: Path }
> = {
  envelope64: {
    label: "drag one of 64 points",
    path: (i) => ({ x: sweep(i, 6) - 3, y: sweep(i + 7, 120, 43) - 60 }),
  },
  fader: {
    label: "drag, controlled",
    path: (i) => ({ x: 0, y: sweep(i, 250) - 125 }),
  },
  // Nothing mounted: what the harness itself costs per move.
  idle: {
    label: "the harness alone",
    path: (i) => ({ x: sweep(i, 300), y: 0 }),
  },
  knob: {
    label: "turn, controlled",
    path: (i) => {
      // Round the centre, as a hand turning the knob does.
      const angle = (sweep(i, 120) * Math.PI) / 180;
      return { x: 60 * Math.sin(angle), y: 60 - 60 * Math.cos(angle) - 60 };
    },
  },
  // No pointer: a source is fed once per frame, as a clock or an audio
  // worklet would, and the frame's cost is what the page's script, style and
  // layout take to follow it.
  "live-meter-32": {
    label: "32 channels, one frame each",
    live: true,
    path: () => ({ x: 0, y: 0 }),
  },
  "live-sequencer-step": {
    label: "the playing step of 1024 cells",
    live: true,
    path: () => ({ x: 0, y: 0 }),
  },
  "live-timeline-playhead": {
    label: "a playhead past 200 marks",
    live: true,
    path: () => ({ x: 0, y: 0 }),
  },
  "live-waveform-playhead": {
    label: "a playhead on a 2048-peak waveform",
    live: true,
    path: () => ({ x: 0, y: 0 }),
  },
  "piano-roll-500": {
    label: "drag one of 500 notes, snapped",
    path: (i) => ({ x: sweep(i, 600), y: sweep(i + 5, 100, 37) }),
  },
  plot: {
    label: "drag a handle",
    path: (i) => ({
      x: sweep(i, 500) - 250,
      y: sweep(i + 11, 200, 53) - 100,
    }),
  },
  "sequencer-1024": {
    click: true,
    label: "press a cell of 1024",
    path: (i) => ({
      x: ((i * 37) % 64) * 18,
      y: (((i * 37) >> 6) % 16) * 18,
    }),
  },
  "sequencer-velocities": {
    label: "draw across 64 velocity bars",
    path: (i) => ({ x: sweep(i, 900), y: sweep(i + 3, 100, 41) - 50 }),
  },
  timeline: {
    label: "scrub past 200 marks",
    path: (i) => ({ x: sweep(i, 900), y: 0 }),
  },
  waveform: {
    label: "scrub a 2048-peak waveform",
    path: (i) => ({ x: sweep(i, 900) - 450, y: 0 }),
  },
  xypad: {
    label: "drag over both axes",
    path: (i) => ({
      x: sweep(i, 280) - 140,
      y: sweep(i + 13, 280, 47) - 140,
    }),
  },
};

const percentile = (sorted: number[], share: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;

// React's production build: the development one checks every render and
// costs several times more, which is not what users get.
const build = await Bun.build({
  define: { "process.env.NODE_ENV": '"production"' },
  entrypoints: [`${import.meta.dir}/scenes.tsx`],
  minify: true,
  target: "browser",
});
if (!build.success) {
  console.error(build.logs.join("\n"));
  process.exit(1);
}
const script = await build.outputs[0]?.text();

const server = Bun.serve({
  fetch: (request) =>
    new URL(request.url).pathname === "/scenes.js"
      ? new Response(script, {
          headers: { "content-type": "text/javascript" },
        })
      : new Response(
          '<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="root"></div><script src="/scenes.js"></script>',
          { headers: { "content-type": "text/html" } }
        ),
  port: 0,
});

// `CHROME_PATH` points at another Chrome; otherwise Playwright's own
// (`bunx playwright-core install chromium`).
const engines: Record<string, BrowserType> = { chromium, firefox, webkit };
const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : Object.keys(engines);
const fmt = (value: number) => value.toFixed(2).padStart(6);
const median = (list: number[]) =>
  percentile(
    [...list].sort((a, b) => a - b),
    0.5
  );
let failed = false;

/**
 * Installed in the page before the scene. Chromium reports what a task costs;
 * Firefox and WebKit do not, so every way script gets to run (event
 * listeners, animation frames, timers, message ports) is wrapped to add up the
 * time spent in it, and before each frame a read of the layout forces the
 * style recalc and layout the frame would do anyway, timed on its own. That
 * leaves out painting, and Firefox and WebKit round timers to a millisecond.
 */
const probe = () => {
  const totals = { layout: 0, script: 0 };
  let depth = 0;
  const timed = <Args extends unknown[]>(
    callback: (...args: Args) => unknown
  ) =>
    function timedCallback(this: unknown, ...args: Args) {
      depth += 1;
      const begin = performance.now();
      try {
        return callback.apply(this, args);
      } finally {
        depth -= 1;
        if (depth === 0) {
          totals.script += performance.now() - begin;
        }
      }
    };

  const listeners = new WeakMap<object, EventListener>();
  const { addEventListener, removeEventListener } = EventTarget.prototype;
  EventTarget.prototype.addEventListener = function add(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    if (!listener) {
      return;
    }
    const call: EventListener =
      typeof listener === "function"
        ? listener
        : (event) => listener.handleEvent(event);
    let wrapped = listeners.get(listener);
    if (!wrapped) {
      wrapped = timed(call) as EventListener;
      listeners.set(listener, wrapped);
    }
    addEventListener.call(this, type, wrapped, options);
  };
  EventTarget.prototype.removeEventListener = function remove(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ) {
    removeEventListener.call(
      this,
      type,
      (listener && listeners.get(listener)) || (listener as EventListener),
      options
    );
  };

  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => raf(timed(callback));
  // React flushes a press in a microtask.
  const microtask = window.queueMicrotask.bind(window);
  window.queueMicrotask = (callback) => microtask(timed(callback));
  const timeout = window.setTimeout.bind(window);
  window.setTimeout = ((
    callback: TimerHandler,
    delay?: number,
    ...rest: unknown[]
  ) =>
    timeout(
      typeof callback === "function"
        ? timed(callback as (...args: unknown[]) => unknown)
        : callback,
      delay,
      ...rest
    )) as typeof window.setTimeout;
  const onmessage = Object.getOwnPropertyDescriptor(
    MessagePort.prototype,
    "onmessage"
  );
  if (onmessage?.set) {
    const { get, set } = onmessage;
    Object.defineProperty(MessagePort.prototype, "onmessage", {
      configurable: true,
      get,
      set(this: MessagePort, handler) {
        set?.call(
          this,
          typeof handler === "function" ? timed(handler) : handler
        );
      },
    });
  }

  const forceLayout = () => {
    const begin = performance.now();
    document.documentElement.getBoundingClientRect();
    totals.layout += performance.now() - begin;
    raf(forceLayout);
  };
  raf(forceLayout);
  (window as unknown as { __totals: typeof totals }).__totals = totals;
};

for (const engine of names) {
  const type = engines[engine];
  if (!type) {
    throw new Error(`Unknown engine "${engine}"`);
  }
  // `CHROME_PATH` points Chromium at another Chrome; otherwise Playwright's
  // own (`bunx playwright-core install`).
  const browser = await type.launch({
    executablePath: engine === "chromium" ? process.env.CHROME_PATH : undefined,
  });
  console.log(`\n${engine} ${browser.version()}`);
  for (const [name, { click, label, live, path }] of Object.entries(gestures)) {
    const page = await browser.newPage({
      viewport: { height: 900, width: 1400 },
    });
    page.on("pageerror", (error) => console.log("page error:", error.message));
    await page.addInitScript(probe);
    await page.goto(`http://localhost:${server.port}/#${name}`);
    const target =
      name === "idle" || live
        ? page.locator("body")
        : page
            .locator('[data-bench="target"], [aria-label="Row 1, step 1"]')
            .first();
    await target.waitFor();
    const box = await target.boundingBox();
    if (!box) {
      throw new Error(`${name}: no target`);
    }
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    if (!live) {
      await page.mouse.move(cx, cy);
    }
    if (!(click || live)) {
      await page.mouse.down();
    }
    // Chromium also reports what its main thread did, a check on the probe.
    const cdp =
      engine === "chromium"
        ? await page.context().newCDPSession(page)
        : undefined;
    await cdp?.send("Performance.enable");
    const busy = async () => {
      const metrics = await cdp?.send("Performance.getMetrics");
      return (
        (metrics?.metrics.find((metric) => metric.name === "TaskDuration")
          ?.value ?? 0) * 1000
      );
    };
    const references: number[] = [];
    const total = WARMUP + RUNS;
    const costs: { layout: number; script: number }[] = [];
    for (let index = 0; index < total; index += 1) {
      const before = await busy();
      const { x, y } = path(index);
      if (!live) {
        await page.mouse.move(cx + x, cy + y);
      }
      if (click) {
        await page.mouse.down();
        await page.mouse.up();
      }
      // One frame, so each move is rendered before the next. A live scene is
      // fed its next value inside the frame, as a clock would.
      const { layout, script } = await page.evaluate(
        (frame) =>
          new Promise<{ layout: number; script: number }>((resolve) =>
            requestAnimationFrame(() => {
              window.__tick?.(frame);
              requestAnimationFrame(() =>
                setTimeout(
                  () =>
                    resolve(
                      (
                        window as unknown as {
                          __totals: { layout: number; script: number };
                        }
                      ).__totals
                    ),
                  0
                )
              );
            })
          ),
        index
      );
      costs.push({ layout, script });
      references.push((await busy()) - before);
    }
    if (!(click || live)) {
      await page.mouse.up();
    }
    const changes = await page.evaluate(() => window.__changes);
    const tasks = costs
      .slice(WARMUP)
      .map(
        (cost, index) =>
          cost.layout +
          cost.script -
          (costs[WARMUP + index - 1]?.layout ?? 0) -
          (costs[WARMUP + index - 1]?.script ?? 0)
      );
    const sorted = [...tasks].sort((a, b) => a - b);
    const p95 = percentile(sorted, 0.95);
    const p99 = percentile(sorted, 0.99);
    // A drag that never reached its handler costs nothing and would pass.
    const worked = name === "idle" || changes > RUNS / 2;
    const ok =
      name === "idle" || (worked && p95 < FRAME_MS && p99 < FRAME_MS * 2);
    failed ||= !ok;
    console.log(
      `${ok ? "pass" : "FAIL"}  ${name.padEnd(15)} ${label.padEnd(32)} p50 ${fmt(median(tasks))}  p95 ${fmt(p95)}  p99 ${fmt(p99)} ms${
        cdp
          ? `   (Chromium's own count: p50 ${fmt(median(references.slice(WARMUP)))}, p95 ${fmt(
              percentile(
                [...references.slice(WARMUP)].sort((a, b) => a - b),
                0.95
              )
            )})`
          : ""
      }${worked ? "" : "  — the gesture did nothing"}`
    );
    await page.close();
  }
  await browser.close();
}

server.stop();
console.log(
  `\nBudget: p95 < ${FRAME_MS.toFixed(2)} ms (one 120 Hz frame: script, style and layout; painting is not counted), p99 < ${(FRAME_MS * 2).toFixed(2)} ms.`
);
process.exit(failed ? 1 : 0);
