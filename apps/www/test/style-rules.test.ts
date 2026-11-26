import { describe, expect, test } from "bun:test";

const STYLES = `${import.meta.dir}/../src/registry/styles/audio`;
const SERVED = `${import.meta.dir}/../public/r/styles/base-nova`;
const SERVED_UI_SDK = `${import.meta.dir}/../public/r/styles/ui-sdk-nova`;
const COMMENT = /\/\*[\s\S]*?\*\//g;
const APPLIED_SELECTOR = /([^{};]+)\{\s*@apply\b/g;
const PLAIN_CLASS = /^\.[a-zA-Z0-9_-]+$/;

const served = async (item: string) => {
  const { css, files } = await Bun.file(`${SERVED}/${item}.json`).json();
  // Every file of the item: an element can keep its parts' classes in a file of their own.
  return {
    content: files
      .map((file: { content: string }) => file.content)
      .join("\n") as string,
    css,
  };
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

  test("on the ui-sdk base, a pressed key's color reads the attribute its primitive writes", async () => {
    const read = async (item: string) =>
      (await Bun.file(`${SERVED_UI_SDK}/${item}.json`).json()).files
        .map((file: { content: string }) => file.content)
        .join("\n") as string;
    expect(await read("piano-react")).toContain(
      '"data-selected": flag(current.active)'
    );
    expect(await read("piano-roll")).toContain(
      "data-[selected]:data-[color]:bg-primary"
    );
  });

  test("a velocity's fill keeps its dim color until its step is on", async () => {
    const { content } = await served("sequencer");
    expect(content).toContain("bg-primary/30");
    expect(content).toContain("group-data-on/sequencer-velocity:bg-primary");
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

// A knob's, a fader's or a meter's color set straight from the shadcn theme, which no audio token can change.
const RAW_COLOR =
  /(?<![\w[-])(?:bg|text)-(?:card|secondary|primary|input|foreground|background|muted-foreground|success|warning|destructive)(?:\/\d+)?(?![\w-])/;
const TOKENED = /^\.cn-(?:knob|fader|meter)(?:-|\s|$)/;

describe("the audio tokens", () => {
  test("every color of a knob, a fader or a meter comes from an audio token, so a skin can change it", async () => {
    const names = await Array.fromAsync(
      new Bun.Glob("style-*.css").scan(STYLES)
    );
    const sheets = await Promise.all(
      names.map((name) => Bun.file(`${STYLES}/${name}`).text())
    );
    const raw: string[] = [];
    for (const [index, name] of names.entries()) {
      const sheet = (sheets[index] ?? "").replace(COMMENT, "");
      for (const [, selector = "", utilities = ""] of sheet.matchAll(
        /([^{};]+)\{\s*@apply([^;]*);/g
      )) {
        const hook = selector.trim();
        if (TOKENED.test(hook) && RAW_COLOR.test(utilities)) {
          raw.push(`${name} ${hook}: ${utilities.match(RAW_COLOR)?.[0]}`);
        }
      }
    }
    expect(raw).toEqual([]);
  });
});
