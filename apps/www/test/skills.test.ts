import { afterEach, describe, expect, test } from "bun:test";
import { audio } from "@/registry-audio/bases/base/audio/_registry";
import { components } from "@/registry-audio/bases/base/components/_registry";
import { hooks } from "@/registry-audio/bases/base/hooks/_registry";
import { lib } from "@/registry-audio/bases/base/lib/_registry";
import { compileSkill, readRules, SKILL_DIR } from "../scripts/build-skill";

/**
 * The skills in `skills/` are installed by people using the library, and
 * they name install commands, entries, attributes and CSS variables. These
 * checks fail the moment one of those names stops existing in the code.
 */

const ROOT = `${import.meta.dir}/../../..`;
const SKILLS_DIR = `${ROOT}/skills`;

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MARKDOWN_LINK = /\]\((\.{1,2}\/[^)#\s]+)/g;
// A whole name: not the start of a template such as `@audio-ui/block-<name>`.
const REGISTRY_NAME = /@audio-ui\/([a-z0-9-]*[a-z0-9])(?![a-z0-9<-])/g;
// An import, not a path into an installed package (`node_modules/@audio-ui/react/dist`).
const REACT_ENTRY = /(?<!node_modules\/)@audio-ui\/react\/([a-z0-9-]+)/g;
const DATA_ATTRIBUTE = /`(data-[a-z-]+)`/g;
const CSS_VARIABLE = /`(--[a-z-]+)`/g;
const ICON_PATH = /icon_(?:small|large): "([^"]+)"/g;
// An `Intl.NumberFormat` unit the skill suggests, as in `{ style: "unit", unit: "hertz" }`.
const INTL_UNIT = /unit: "([a-z-]+)"/g;
const INTL_UNITS = new Set<string>(Intl.supportedValuesOf("unit"));
const RULE_ID =
  /`((?:audio|live|values|a11y|core|design|style|ai)-[a-z0-9-]+)`/g;
const CORE_ENTRY = /(?<!node_modules\/)@audio-ui\/core\/([a-z0-9-]+)/g;
// A fenced code block of a markdown file.
const CODE_FENCE = /```\w*\n([\s\S]*?)```/g;
// An `@audio-ui/core/<entry>` import specifier in code.
const CORE_SPECIFIER = /"@audio-ui\/core\/([a-z-]+)"/g;
// A row of core.md's export table: the entry, then the names it exports.
const CORE_EXPORT_ROW = /^\| `@audio-ui\/core(?:\/([a-z-]+))?` \| (.+) \|$/gm;
const IDENTIFIER = /`([A-Za-z_][A-Za-z0-9_]*)`/g;

// A number in a selector, such as the `.5` of a decimal value.
const DIGIT_START = /^\d/;

// A registry item kept only to redirect an old install name.
const RETIRED = /^(Gone|Renamed|Moved)/;

const PACKAGES = new Set(["react", "core"]);

function matches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1] ?? "");
}

/** Every file under `cwd` matching `pattern`, as absolute paths with their text. */
async function read(pattern: string, cwd: string) {
  const paths = await Array.fromAsync(
    new Bun.Glob(pattern).scan({ absolute: true, cwd })
  );
  return Promise.all(
    paths.map(async (path) => ({ path, text: await Bun.file(path).text() }))
  );
}

const exists = (path: string | URL) => Bun.file(path).exists();

const skills = (
  await Array.fromAsync(new Bun.Glob("*/SKILL.md").scan({ cwd: SKILLS_DIR }))
).map((path) => path.split("/")[0] ?? "");
const markdown = await read("**/*.md", SKILLS_DIR);
const registryNames = new Set(
  [...audio, ...components, ...hooks, ...lib].map((item) => item.name)
);
const uiExports = Object.keys(
  (await Bun.file(`${ROOT}/packages/ui/package.json`).json()).exports
);
const coreExports = Object.keys(
  (await Bun.file(`${ROOT}/packages/core/package.json`).json()).exports
);
const uiSource = (await read("**/*.{ts,tsx}", `${ROOT}/packages/ui/src`))
  .map((file) => file.text)
  .join("\n");
const { errors, rules } = await readRules();
const skill = await Bun.file(`${SKILL_DIR}/SKILL.md`).text();

describe.each(skills)("skills/%s", (name) => {
  const dir = `${SKILLS_DIR}/${name}`;

  test("has a valid name and description", async () => {
    const source = await Bun.file(`${dir}/SKILL.md`).text();
    const frontmatter = Bun.YAML.parse(
      source.match(FRONTMATTER)?.[1] ?? ""
    ) as Record<string, unknown>;
    expect(frontmatter.name).toBe(name);
    expect(name).toMatch(SKILL_NAME);
    expect(name.length).toBeLessThanOrEqual(64);
    expect(typeof frontmatter.description).toBe("string");
    expect(String(frontmatter.description).length).toBeLessThanOrEqual(1024);
  });

  test("its evals are well formed", async () => {
    const evals = await Bun.file(`${dir}/evals/evals.json`).json();
    expect(evals.skill_name).toBe(name);
    const ids = evals.evals.map((item: { id: number }) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of evals.evals) {
      expect(item.prompt.length).toBeGreaterThan(0);
      expect(item.expectations.length).toBeGreaterThan(0);
    }
  });

  test("its agent metadata points at real icons", async () => {
    const metadata = await Bun.file(`${dir}/agents/openai.yml`).text();
    const icons = matches(metadata, ICON_PATH);
    const found = await Promise.all(
      icons.map((icon) => exists(`${dir}/${icon}`))
    );
    expect(found.every(Boolean)).toBe(true);
  });
});

describe.each(markdown)("$path", ({ path, text }) => {
  test("relative links resolve", async () => {
    const base = Bun.pathToFileURL(path);
    const links = matches(text, MARKDOWN_LINK);
    const broken = (
      await Promise.all(
        links.map(async (link) =>
          (await exists(new URL(link, base))) ? null : link
        )
      )
    ).filter(Boolean);
    expect(broken).toEqual([]);
  });

  test("every @audio-ui/<name> is a registry item or a package", () => {
    const missing = matches(text, REGISTRY_NAME).filter(
      (name) => !(PACKAGES.has(name) || registryNames.has(name))
    );
    expect(missing).toEqual([]);
  });

  test("every @audio-ui/react/<entry> is exported", () => {
    const missing = matches(text, REACT_ENTRY).filter(
      (entry) => !uiExports.includes(`./${entry}`)
    );
    expect(missing).toEqual([]);
  });

  test("every @audio-ui/core/<entry> is exported", () => {
    const missing = matches(text, CORE_ENTRY).filter(
      (entry) => !coreExports.includes(`./${entry}`)
    );
    expect(missing).toEqual([]);
  });

  test("every Intl unit it suggests exists", () => {
    const invalid = matches(text, INTL_UNIT).filter(
      (unit) => !INTL_UNITS.has(unit)
    );
    expect(invalid).toEqual([]);
  });

  test("every data attribute and CSS variable exists in the primitives", () => {
    const missing = [
      ...matches(text, DATA_ATTRIBUTE),
      ...matches(text, CSS_VARIABLE),
    ].filter((name) => !uiSource.includes(name.replace("data-", "")));
    expect(missing).toEqual([]);
  });
});

describe("skills/audio-ui rules", () => {
  test("every rule is well formed", () => {
    expect(errors).toEqual([]);
  });

  test("the Quick Reference lists exactly the rules", () => {
    const listed = new Set(matches(skill, RULE_ID));
    const ids = new Set(rules.map((rule) => rule.id));
    expect([...ids].filter((id) => !listed.has(id))).toEqual([]);
    expect([...listed].filter((id) => !ids.has(id))).toEqual([]);
  });

  test("AGENTS.md is the output of bun run skill:build", async () => {
    expect(await Bun.file(`${SKILL_DIR}/AGENTS.md`).text()).toBe(
      await compileSkill()
    );
  });

  test("SKILL.md and metadata.json carry the same version", async () => {
    const metadata = await Bun.file(`${SKILL_DIR}/metadata.json`).json();
    const frontmatter = Bun.YAML.parse(skill.match(FRONTMATTER)?.[1] ?? "") as {
      metadata?: { version?: string };
    };
    expect(frontmatter.metadata?.version).toBe(metadata.version);
  });
});

test("core.md lists only names its entries export", async () => {
  const core = await Bun.file(`${SKILL_DIR}/core.md`).text();
  const rows = await Promise.all(
    [...core.matchAll(CORE_EXPORT_ROW)].map(async ([, entry, names = ""]) => {
      // A primitive lives in primitives/<entry>, an audio module in audio/<entry>.
      const primitive = `${ROOT}/packages/core/src/primitives/${entry}/index.ts`;
      let index = `${ROOT}/packages/core/src/index.ts`;
      if (entry) {
        index = (await Bun.file(primitive).exists())
          ? primitive
          : `${ROOT}/packages/core/src/audio/${entry}/index.ts`;
      }
      const source = await Bun.file(index).text();
      return matches(names, IDENTIFIER)
        .filter((name) => !source.includes(name))
        .map((name) => `${entry ?? "."}: ${name}`);
    })
  );
  expect(rows.flat()).toEqual([]);
});

// The plain DOM example writes into the document: leave it as it was found,
// so the component tests that query the whole body don't see its controls.
afterEach(() => {
  document.body.innerHTML = "";
});

test("core.md's plain DOM knob works", async () => {
  const core = await Bun.file(`${SKILL_DIR}/core.md`).text();
  const blocks = [...core.matchAll(CODE_FENCE)].map(([, code = ""]) => code);
  const html = blocks.find((code) => code.includes('id="cutoff"'));
  const example = blocks.find((code) =>
    code.includes("export function mountKnob")
  );
  if (!(html && example)) {
    throw new Error("core.md: the plain DOM knob example is missing");
  }

  // Run the example as written, with its import pointed at the source.
  const source = new Bun.Transpiler({ loader: "ts" })
    .transformSync(example)
    .replace(
      CORE_SPECIFIER,
      (_, entry) => `"${ROOT}/packages/core/src/primitives/${entry}/index.ts"`
    );
  const file = Bun.file(
    `${Bun.env.TMPDIR ?? "/tmp"}/mount-knob-${crypto.randomUUID()}.js`
  );
  await Bun.write(file, source);
  const { mountKnob } = await import(file.name ?? "");
  await file.delete();

  document.body.innerHTML = html;
  const root = document.getElementById("cutoff");
  const input = root?.querySelector("input");
  if (!(root && input)) {
    throw new Error("core.md: the example's markup has no knob");
  }
  let changes = 0;
  const knob = mountKnob(root, {
    max: 20_000,
    min: 20,
    onValueChange: () => {
      changes += 1;
    },
    scale: "log",
  });

  // The middle of a logarithmic travel, not the linear one.
  expect(input.value).toBe("632");

  // A press: the primary button only, no browser gesture, focus on the input.
  const control = root.querySelector("[data-part=control]");
  expect(control?.getAttribute("style")).toContain("touch-action: none");
  const press = (button: number) => {
    const event = new PointerEvent("pointerdown", {
      bubbles: true,
      button,
      cancelable: true,
      pointerId: 1,
    });
    control?.dispatchEvent(event);
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    return event;
  };
  expect(press(2).defaultPrevented).toBe(false);
  expect(document.activeElement).not.toBe(input);
  expect(press(0).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(input);
  const key = () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { cancelable: true, key: "ArrowUp" })
    );
  key();
  expect(changes).toBe(1);
  knob.update({ disabled: true });
  expect(input.disabled).toBe(true);
  knob.destroy();
  key();
  expect(changes).toBe(1);
});

describe("skills/audio-ui styles", () => {
  const STYLES = `${SKILL_DIR}/styles`;
  const CLASS_NAME = /className="([a-z-]+)"/g;
  const SELECTOR_CLASS = /\.([a-z][a-z0-9-]*)/g;
  const SKINS = [
    "retro",
    "minimal",
    "modern",
    "tape",
    "phosphor",
    "hifi",
    "brutalist",
    "y2k",
    "console",
    "synth70",
    "tube",
    "solidstate",
    "plugin",
    "blackface",
    "gunmetal",
    "opto",
    "blacky",
    "bluey",
  ] as const;

  /** The kit's markup: the code block of directions.md that exports `Panel`. */
  const readPanel = async () => {
    const directions = await Bun.file(`${SKILL_DIR}/directions.md`).text();
    const block = matches(directions, CODE_FENCE).find((code) =>
      code.includes("export function Panel")
    );
    if (!block) {
      throw new Error("directions.md: the Panel markup is missing");
    }
    return block;
  };

  test("the kit's markup renders and every class has a rule in the styles", async () => {
    const { renderToString } = await import("react-dom/server");
    const { createElement } = await import("react");
    // Rendered from inside the app, where react and the primitives resolve.
    const copy = `${import.meta.dir}/skill-panel.tmp.tsx`;
    const source = await readPanel();
    await Bun.write(copy, source);
    const panel = await import(copy).finally(() => Bun.file(copy).delete());
    const html = renderToString(
      createElement(panel.Panel, { skin: "retro", title: "Kit" })
    );
    expect(html).toContain("skin-retro");
    const sheets = await Promise.all(
      ["base", ...SKINS].map((name) => Bun.file(`${STYLES}/${name}.css`).text())
    );
    const defined = new Set(matches(sheets.join("\n"), SELECTOR_CLASS));
    const missing = matches(source, CLASS_NAME).filter(
      (name) => !(defined.has(name) || name.startsWith("skin-"))
    );
    expect(missing).toEqual([]);
  });

  test.each([...SKINS])(
    "the %s skin styles only classes the markup has",
    async (skin) => {
      const css = await Bun.file(`${STYLES}/${skin}.css`).text();
      const used = new Set(matches(await readPanel(), CLASS_NAME));
      // Decorative helpers a skin offers for the author to add to the markup.
      const extras = new Set([
        "display",
        "knob-numeral",
        "panel-footer",
        "lamp",
        "legend",
        "panel",
        "rocker",
        "screw",
        "screw-bl",
        "screw-br",
        "screw-tl",
        "screw-tr",
        "scale",
        "section",
      ]);
      const unknown = matches(css, SELECTOR_CLASS).filter(
        (name) =>
          !(
            used.has(name) ||
            extras.has(name) ||
            name.startsWith("skin-") ||
            DIGIT_START.test(name)
          )
      );
      expect(unknown).toEqual([]);
    }
  );
});

test("core.md's kit knob and fader work in the plain DOM", async () => {
  const core = await Bun.file(`${SKILL_DIR}/core.md`).text();
  const example = [...core.matchAll(CODE_FENCE)]
    .map(([, code = ""]) => code)
    .find((code) => code.includes("export function mountKitKnob"));
  if (!example) {
    throw new Error("core.md: the kit's plain DOM example is missing");
  }
  const source = new Bun.Transpiler({ loader: "ts" })
    .transformSync(example)
    .replace(
      CORE_SPECIFIER,
      (_, entry) => `"${ROOT}/packages/core/src/primitives/${entry}/index.ts"`
    );
  const copy = `${import.meta.dir}/skill-kit.tmp.js`;
  await Bun.write(copy, source);
  const { mountKitFader, mountKitKnob } = await import(copy).finally(() =>
    Bun.file(copy).delete()
  );

  document.body.innerHTML =
    '<div class="knob" id="k"></div><div class="fader" id="f"></div>';
  const knobRoot = document.getElementById("k");
  const faderRoot = document.getElementById("f");
  if (!(knobRoot && faderRoot)) {
    throw new Error("the kit's example has no roots");
  }
  const changes: number[] = [];
  const cleanKnob = mountKitKnob(knobRoot, "Cutoff", {
    dragMode: "vertical",
    max: 100,
    min: 0,
    onValueChange: (value: number) => changes.push(value),
  });
  const cleanFader = mountKitFader(faderRoot, "Level", {
    max: 0,
    min: -60,
    onValueChange: (value: number) => changes.push(value),
    orientation: "vertical",
  });
  for (const name of [
    "knob-control",
    "knob-thumb",
    "knob-track",
    "knob-indicator",
    "knob-mark",
    "knob-label",
    "knob-value",
    "fader-control",
    "fader-track",
    "fader-indicator",
    "fader-thumb",
  ]) {
    expect(document.querySelector(`.${name}`)).not.toBeNull();
  }
  expect(
    knobRoot.querySelector(".knob-control")?.getAttribute("data-drag-mode")
  ).toBe("vertical");
  for (const input of document.querySelectorAll("input")) {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { cancelable: true, key: "ArrowUp" })
    );
  }
  expect(changes).toHaveLength(2);
  cleanKnob();
  cleanFader();
});

describe("the Claude Code marketplace", () => {
  const manifest = Bun.file(
    `${ROOT}/.claude-plugin/marketplace.json`
  ).json() as Promise<{
    name: string;
    owner: { name: string };
    plugins: { description: string; name: string; source: string }[];
  }>;

  test("it is named and owned, and lists each plugin once", async () => {
    const { name, owner, plugins } = await manifest;
    expect(name).toMatch(SKILL_NAME);
    expect(owner.name).toBeTruthy();
    expect(new Set(plugins.map((plugin) => plugin.name)).size).toBe(
      plugins.length
    );
  });

  test("each plugin is a skill folder of this repository, under its own name", async () => {
    const { plugins } = await manifest;
    const sources = await Promise.all(
      plugins.map((plugin) =>
        Bun.file(`${ROOT}/${plugin.source}/SKILL.md`)
          .text()
          .catch(() => "")
      )
    );
    plugins.forEach((plugin, index) => {
      expect(plugin.name).toMatch(SKILL_NAME);
      expect(plugin.description.length).toBeGreaterThan(20);
      expect(plugin.source.startsWith("./skills/")).toBe(true);
      expect(sources[index]).toContain(`name: ${plugin.name}\n`);
    });
  });

  test("every skill of the repository is in it", async () => {
    const { plugins } = await manifest;
    expect(plugins.map((plugin) => plugin.source).sort()).toEqual(
      skills.map((name) => `./skills/${name}`).sort()
    );
  });
});

test("components.md names every registry item, but demos and retired items", async () => {
  const catalog = await Bun.file(`${SKILL_DIR}/components.md`).text();
  const items = [...audio, ...hooks, ...lib].filter(
    (item) => !RETIRED.test(item.description ?? "")
  );
  const missing = items
    .map((item) => item.name)
    .filter((name) => !catalog.includes(name));
  expect(missing).toEqual([]);
});
