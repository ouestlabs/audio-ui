import { describe, expect, test } from "bun:test";
import {
  camelName,
  devicePanelUsage,
  expandDeviceUsage,
  pascalName,
} from "@/lib/docs/content/device-usage";

const DEVICES = `${import.meta.dir}/../src/content/docs/components/base/(devices)`;
const INTRO =
  "It is a [device](/docs/devices): a state, a panel, an engine and tools, each its own file.";
const ENGINE =
  "Create it, connect it and update it as for any device: see [The engine](/docs/devices#the-engine).";

describe("device usage", () => {
  test("a slug is named the way the device files name their exports", () => {
    expect(camelName("auto-pan")).toBe("autoPan");
    expect(pascalName("channel-eq")).toBe("ChannelEq");
    expect(pascalName("delay")).toBe("Delay");
  });

  test("the snippet imports the panel and the device of the page, and keeps the state in the host", () => {
    expect(devicePanelUsage("mid-side")).toBe(
      [
        'import { MidSidePanel } from "@/components/audio-ui/devices/mid-side/panel";',
        'import { midSideDevice } from "@/components/audio-ui/devices/mid-side/device";',
        "",
        "const [state, setState] = useState(() => midSideDevice.defaults());",
        "",
        "<MidSidePanel onValueChange={setState} value={state} />;",
      ].join("\n")
    );
  });

  test("a tag is a tsx fence for the markdown pages", () => {
    const out = expandDeviceUsage(
      'Before\n\n<DeviceUsage name="delay" />\n\nAfter'
    );
    expect(out).toContain("```tsx\nimport { DelayPanel }");
    expect(out.startsWith("Before")).toBe(true);
    expect(out.endsWith("After")).toBe(true);
  });
});

test("every device page shows its own panel and says what every device page says", async () => {
  const wrong: string[] = [];
  let pages = 0;
  for await (const file of new Bun.Glob("*.mdx").scan(DEVICES)) {
    pages += 1;
    const slug = file.replace(".mdx", "");
    const text = await Bun.file(`${DEVICES}/${file}`).text();
    for (const [what, needle] of [
      ["its <DeviceUsage />", `<DeviceUsage name="${slug}" />`],
      ["its <Install />", `<Install name="${slug}" kind="device" />`],
      ["the sentence on what a device is", INTRO],
      ["the sentence on the engine", ENGINE],
    ] as const) {
      if (!text.includes(needle)) {
        wrong.push(`${slug}: ${what}`);
      }
    }
  }
  expect(pages).toBe(22);
  expect(wrong).toEqual([]);
});
