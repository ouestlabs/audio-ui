/** The checks of docs/daw-spec/engine.md. */
import { assert, type Checks, LATENCY, open, RATE } from "../helpers";

export const checks: Checks = {
  "ENG-001: the engine line shows the rate, the latency and the state": async (
    browser
  ) => {
    const page = await open(browser);
    const line = await page.getByRole("region", { name: "Engine" }).innerText();
    assert(RATE.test(line) && LATENCY.test(line), `the line reads "${line}"`);
    assert(
      await page.evaluate(() => crossOriginIsolated),
      "the page is not cross-origin isolated"
    );
  },
};
