/**
 * Runs the conformance page in a headless Chrome and fails when a check does.
 *
 *   bun run conformance [url]
 *
 * The page renders the real engines in an offline audio context, so it needs a
 * browser: Chrome is started with `--dump-dom` and the result is read from the
 * page's own markers (`data-done`, and `data-state` on each check). No browser
 * driver is installed; set `CHROME` to the browser's path when it is not one of
 * the usual ones.
 */
export {};

const URL_ARG = Bun.argv[2] ?? "http://localhost:4000/conformance";
const TIMEOUT_MS = 120_000;
const CANDIDATES = [
  Bun.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
].filter((path): path is string => Boolean(path));

const CHECK = /<li[^>]*data-check="([^"]+)"[^>]*data-state="([^"]+)"/g;
const DONE = /id="conformance-summary"[^>]*data-done/;

const chrome = CANDIDATES.find(
  (path) =>
    Bun.which(path) !== null || (path.includes("/") && Bun.file(path).size > 0)
);
if (!chrome) {
  console.error("No Chrome found: set CHROME to its path.");
  process.exit(2);
}

const child = Bun.spawn(
  [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--dump-dom",
    "--virtual-time-budget=60000",
    URL_ARG,
  ],
  { stderr: "ignore", stdout: "pipe" }
);
const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
const dom = await new Response(child.stdout).text();
clearTimeout(timer);

if (!DONE.test(dom)) {
  console.error(`The checks did not finish at ${URL_ARG}.`);
  process.exit(2);
}

const checks = [...dom.matchAll(CHECK)].map(([, id = "", state = ""]) => ({
  id,
  state,
}));
const failing = checks.filter(({ state }) => state !== "pass");
console.log(
  `${checks.length - failing.length} of ${checks.length} checks pass.`
);
for (const { id, state } of failing) {
  console.error(`  ${state}: ${id}`);
}
process.exit(checks.length > 0 && failing.length === 0 ? 0 : 1);
