import { DEMO_SOURCES } from "@/registry-audio/bases/base/lib/demo-sound";

const DEMO_SOUNDS_TAG = /<DemoSounds\s*\/>/g;

/** The sounds a reader listens to on the page, as the table an agent reads: each by name, with what to listen for. */
export function demoSoundsTable() {
  return [
    "| Name | Sound | What to listen for |",
    "| --- | --- | --- |",
    ...Object.entries(DEMO_SOURCES).map(
      ([name, source]) => `| \`${name}\` | ${source.title} | ${source.about} |`
    ),
  ].join("\n");
}

/** Each `<DemoSounds />` of a page as the table of the sounds. */
export function expandDemoSounds(content: string) {
  return content.replace(DEMO_SOUNDS_TAG, demoSoundsTable);
}
