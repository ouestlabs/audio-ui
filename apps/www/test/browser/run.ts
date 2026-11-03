/**
 * Checks that need a real browser: what the registry's audio libraries do in
 * an AudioContext, an AudioWorklet or an offline render, which happy-dom has
 * none of. Each `*.check.ts` beside this file is bundled for the browser and
 * opened in Chromium, from a page that is cross-origin isolated, as an app
 * that shares memory with its worklets is. Run with `bun run test:browser`,
 * or name the files: `bun test/browser/run.ts clip-player`.
 *
 * `CHROME_PATH` points at another Chrome; otherwise Playwright's own
 * (`bunx playwright-core install chromium`).
 */
import { chromium } from "playwright-core";
import type { CheckResult } from "./harness.ts";

const requested = process.argv.slice(2);
const files =
  requested.length > 0
    ? requested.map((name) => `${name}.check.ts`)
    : [...new Bun.Glob("*.check.ts").scanSync(import.meta.dir)].sort();

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
  executablePath: process.env.CHROME_PATH,
});

/** Opens one check file in a page of its own and prints its results; the number that failed. */
async function runFile(file: string): Promise<number> {
  let failed = 0;
  const build = await Bun.build({
    entrypoints: [`${import.meta.dir}/${file}`],
    format: "esm",
    target: "browser",
  });
  const [output] = build.outputs;
  if (!(build.success && output)) {
    console.error(build.logs.map(String).join("\n"));
    process.exit(1);
  }
  const script = await output.text();
  const isolated = {
    "cross-origin-embedder-policy": "require-corp",
    "cross-origin-opener-policy": "same-origin",
  };
  const server = Bun.serve({
    fetch: (request) =>
      new URL(request.url).pathname === "/check.js"
        ? new Response(script, {
            headers: { ...isolated, "content-type": "text/javascript" },
          })
        : new Response(
            '<!doctype html><meta charset="utf-8"><script type="module" src="/check.js"></script>',
            { headers: { ...isolated, "content-type": "text/html" } }
          ),
    port: 0,
  });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://localhost:${server.port}/`);
  await page.waitForFunction(() => typeof window.runChecks === "function");
  const results: CheckResult[] = await page.evaluate(() => window.runChecks());
  console.log(`\n${file}`);
  for (const result of results) {
    console.log(`  ${result.ok ? "pass" : "FAIL"} ${result.name}`);
    if (!result.ok) {
      failed += 1;
      console.log(`       ${result.message}`);
    }
  }
  for (const error of errors) {
    failed += 1;
    console.log(`  FAIL page error: ${error}`);
  }
  await page.close();
  server.stop(true);
  return failed;
}

// One file at a time, for the same reason as the checks: they share the audio device.
const failed = await files.reduce<Promise<number>>(
  async (total, file) => (await total) + (await runFile(file)),
  Promise.resolve(0)
);

await browser.close();
console.log(failed === 0 ? "\nAll checks pass." : `\n${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
