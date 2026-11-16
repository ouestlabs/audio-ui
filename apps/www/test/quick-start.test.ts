import { expect, test } from "bun:test";
import { FRAMEWORKS } from "@/lib/docs/content/frameworks";
import {
  BUILD_PROMPT,
  expandLinkCards,
  expandQuickStart,
  QUICK_START_PROMPTS,
} from "@/lib/docs/content/quick-start";

test("every framework has a prompt that names its install and the agent's resources", () => {
  for (const { id } of FRAMEWORKS) {
    const prompt = QUICK_START_PROMPTS[id];
    expect(prompt).toContain("https://www.audio-ui.dev/llms.txt");
    expect(prompt).toContain("npx skills@latest add ouestlabs/audio-ui");
    expect(prompt).toContain("https://www.audio-ui.dev/mcp");
    if (id !== "react") {
      expect(prompt).toContain("do it by hand");
    }
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

test("the cards of a page served as markdown are a list of links", () => {
  const text = expandLinkCards(
    '<LinkCards>\n<LinkCard href="/docs/core" title="Core">The logic of the controls.</LinkCard>\n</LinkCards>'
  );
  expect(text.trim()).toBe("- [Core](/docs/core): The logic of the controls.");
});
