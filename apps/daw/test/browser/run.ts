/**
 * The workstation in Chromium, driven with the mouse and the keyboard as a
 * person would: what docs/daw-spec asks of it end to end. Run the app first
 * (`bun run dev`), then `bun run test:browser`, or name checks:
 * `bun test/browser/run.ts ARR-006`. `DAW_URL` points at another server.
 *
 * Each check opens a fresh profile, so the project starts new, except where
 * a check reloads to see what was kept.
 */

import { type Browser, chromium } from "playwright-core";
import { checks as arrangement } from "./checks/arrangement";
import { checks as audioClips } from "./checks/audio-clips";
import { checks as automation } from "./checks/automation";
import { checks as devices } from "./checks/devices";
import { checks as engine } from "./checks/engine";
import { checks as exportChecks } from "./checks/export";
import { checks as gaps } from "./checks/gaps";
import { checks as midi } from "./checks/midi";
import { checks as mixer } from "./checks/mixer";
import { checks as project } from "./checks/project";
import { checks as recording } from "./checks/recording";
import { checks as shortcuts } from "./checks/shortcuts";
import { checks as transport } from "./checks/transport";
import type { Checks } from "./helpers";

const checks: Checks = {
  ...engine,
  ...arrangement,
  ...transport,
  ...exportChecks,
  ...midi,
  ...devices,
  ...shortcuts,
  ...mixer,
  ...recording,
  ...automation,
  ...audioClips,
  ...gaps,
  ...project,
};

const wanted = process.argv.slice(2);
const names = Object.keys(checks).filter(
  (name) => wanted.length === 0 || wanted.some((id) => name.startsWith(id))
);
const chrome = await chromium.launch({
  headless: process.env.HEADED ? false : undefined,
  // A fake microphone, a tone, granted without asking: what a take records (REC).
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
  executablePath: process.env.CHROME_PATH,
});
const failed = await names.reduce<Promise<number>>(async (count, name) => {
  const total = await count;
  try {
    await (checks[name] as (browser: Browser) => Promise<void>)(chrome);
    console.log(`  pass ${name}`);
    return total;
  } catch (error) {
    console.log(
      `  FAIL ${name}\n       ${error instanceof Error ? error.message : String(error)}`
    );
    return total + 1;
  } finally {
    // A check leaves its pages open: closed here, so one app at a time plays, not every check's at once.
    await Promise.all(chrome.contexts().map((context) => context.close()));
  }
}, Promise.resolve(0));
await chrome.close();
console.log(failed === 0 ? "\nAll checks pass." : `\n${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
