import { describe, expect, test } from "bun:test";

const STYLES = `${import.meta.dir}/../src/registry-audio/styles`;
const SERVED = `${import.meta.dir}/../public/r/styles/base-nova`;
const COMMENT = /\/\*[\s\S]*?\*\//g;
const APPLIED_SELECTOR = /([^{};]+)\{\s*@apply\b/g;
const PLAIN_CLASS = /^\.[a-zA-Z0-9_-]+$/;

const served = async (item: string) => {
  const { css, files } = await Bun.file(`${SERVED}/${item}.json`).json();
  return { content: files[0].content as string, css };
};

describe("a style's rules reach a project", () => {
  // The build turns `cn-x` into what `.cn-x` applies. A rule of any other shape
  // works on this site, which reads the sheet, and never reaches an install.
  test("every rule is one plain class, its states written as variants", async () => {
    const names = await Array.fromAsync(
      new Bun.Glob("style-*.css").scan(STYLES)
    );
    const sheets = await Promise.all(
      names.map((name) => Bun.file(`${STYLES}/${name}`).text())
    );
    const compound = sheets
      .flatMap((sheet) => [
        ...sheet.replace(COMMENT, "").matchAll(APPLIED_SELECTOR),
      ])
      .map(([, selector]) => selector?.trim() ?? "")
      .filter((selector) => !PLAIN_CLASS.test(selector));
    expect(compound).toEqual([]);
  });

  test("a roll's black keys are black, and a pressed key shows it", async () => {
    const { content } = await served("piano-roll");
    expect(content).toContain("data-[color=black]:bg-foreground/85");
    expect(content).toContain("data-[active]:data-[color]:bg-primary");
  });

  test("a velocity's fill keeps its dim color until its step is on", async () => {
    const { content } = await served("sequencer");
    expect(content).toContain("bg-primary/30");
    expect(content).toContain("group-data-on/velocity:bg-primary");
  });

  test("the envelopes bring the shake they refuse with", async () => {
    const items = await Promise.all(
      ["envelope", "automation-envelope"].map(served)
    );
    for (const { content, css } of items) {
      expect(css["@keyframes envelope-shake"]).toBeDefined();
      expect(content).toContain("data-blocked:animate-[envelope-shake");
    }
  });
});
