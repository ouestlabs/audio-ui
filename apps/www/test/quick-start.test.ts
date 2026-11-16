import { expect, test } from "bun:test";
import { FRAMEWORKS } from "@/lib/docs/content/frameworks";
import {
  BUILD_PROMPT,
  expandQuickStart,
  QUICK_START_PROMPTS,
} from "@/lib/docs/content/quick-start";

test("every framework has a prompt that names its install and the agent's resources", () => {
  for (const { id } of FRAMEWORKS) {
    const prompt = QUICK_START_PROMPTS[id];
    expect(prompt).toContain("https://www.audio-ui.dev/llms.txt");
    expect(prompt).toContain("npx skills@latest add ouestlabs/audio-ui");
    expect(prompt).toContain("https://www.audio-ui.dev/mcp");
    expect(prompt).toContain(
      id === "react" ? "@audio-ui/knob" : `knob-${id}.json`
    );
  }
});

test("a page served as markdown shows the prompts in place of the component", () => {
  const text = expandQuickStart("## Quick Start\n\n<QuickStart />\n");
  expect(text).not.toContain("<QuickStart");
  for (const { id } of FRAMEWORKS) {
    expect(text).toContain(QUICK_START_PROMPTS[id]);
  }
  expect(text).toContain(BUILD_PROMPT);
});
