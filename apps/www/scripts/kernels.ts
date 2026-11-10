// The audio.js kernels each device runs in an AudioWorklet, and the file that
// carries them: a worklet cannot import, so a device holds their code as
// published, in a string. `build-kernels.ts` writes the files, and
// `test/kernels.test.ts` fails when one no longer matches the packages.

interface Kernel {
  /** The module that holds it, in the package. */
  file: string;
  name: string;
  /**
   * What the worklet calls, by the names the module exports it under, by
   * default or by name: one function, or several.
   */
  use: string | readonly string[];
}

interface KernelSet {
  /** The constant the file exports. */
  constant: string;
  /** The file it writes, from `registry-audio/bases/base/`. */
  file: string;
  kernels: readonly Kernel[];
}

export const KERNEL_SETS: readonly KernelSet[] = [
  {
    constant: "DELAY_KERNELS",
    file: "devices/delay/kernels.ts",
    kernels: [
      { file: "ping-pong.js", name: "@audio/effect-pingpong", use: "pingPong" },
      { file: "multitap.js", name: "@audio/effect-multitap", use: "multitap" },
      {
        file: "graindelay.js",
        name: "@audio/effect-graindelay",
        use: "graindelay",
      },
    ],
  },
  {
    constant: "LOFI_KERNELS",
    file: "devices/lofi/kernels.ts",
    kernels: [{ file: "lofi.js", name: "@audio/effect-lofi", use: "lofi" }],
  },
  {
    constant: "REDUX_KERNELS",
    file: "devices/redux/kernels.ts",
    kernels: [
      {
        file: "bitcrusher.js",
        name: "@audio/effect-bitcrusher",
        use: "bitcrusher",
      },
      {
        file: "noise-shaping.js",
        name: "@audio/effect-noiseshaper",
        use: "noiseShaping",
      },
    ],
  },
  {
    constant: "PHASER_KERNELS",
    file: "devices/phaser/kernels.ts",
    kernels: [
      { file: "phaser.js", name: "@audio/effect-phaser", use: "phaser" },
    ],
  },
  {
    constant: "CHORUS_KERNELS",
    file: "devices/chorus/kernels.ts",
    kernels: [
      { file: "chorus.js", name: "@audio/effect-chorus", use: "chorus" },
    ],
  },
  {
    constant: "MID_SIDE_KERNELS",
    file: "devices/mid-side/kernels.ts",
    kernels: [
      {
        file: "microshift.js",
        name: "@audio/spatial-microshift",
        use: "shifter",
      },
    ],
  },
  {
    constant: "TILT_EQ_KERNELS",
    file: "devices/tilt-eq/kernels.ts",
    kernels: [
      {
        file: "biquad.js",
        name: "@audio/biquad",
        use: ["lowshelf", "highshelf", "filter"],
      },
      { file: "tilt.js", name: "@audio/eq-tilt", use: "tilt" },
    ],
  },
  {
    constant: "WAH_KERNELS",
    file: "devices/wah/kernels.ts",
    kernels: [
      { file: "auto-wah.js", name: "@audio/effect-autowah", use: "autoWah" },
      { file: "wah.js", name: "@audio/effect-wah", use: "wah" },
    ],
  },
  {
    constant: "FREQUENCY_SHIFTER_KERNELS",
    file: "devices/frequency-shifter/kernels.ts",
    kernels: [
      {
        file: "frequency-shifter.js",
        name: "@audio/effect-freqshift",
        use: "frequencyShifter",
      },
      { file: "ring-mod.js", name: "@audio/effect-ringmod", use: "ringMod" },
    ],
  },
  {
    constant: "EXCITER_KERNELS",
    file: "devices/exciter/kernels.ts",
    kernels: [
      { file: "exciter.js", name: "@audio/effect-exciter", use: "exciter" },
    ],
  },
  {
    constant: "BASS_ENHANCER_KERNELS",
    file: "devices/bass-enhancer/kernels.ts",
    kernels: [
      { file: "subbass.js", name: "@audio/effect-subbass", use: "subbass" },
    ],
  },
  {
    constant: "FILTER_KERNELS",
    file: "devices/filter/kernels.ts",
    kernels: [
      {
        file: "moog-ladder.js",
        name: "@audio/filter-moog-ladder",
        use: "moogLadder",
      },
      {
        file: "diode-ladder.js",
        name: "@audio/filter-diode-ladder",
        use: "diodeLadder",
      },
      { file: "korg35.js", name: "@audio/filter-korg35", use: "korg35" },
      { file: "oberheim.js", name: "@audio/filter-oberheim", use: "oberheim" },
    ],
  },
];

export const KERNELS_DIR = `${import.meta.dir}/../src/registry-audio/bases/base`;

const PACKAGE_JSON = /package\.json$/;
const IMPORT = /^\s*import\s/m;
/** An import of names from a package: `import { a, b } from "pkg"`. */
const NAMED_IMPORT =
  /^\s*import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?[ \t]*\n?/gm;
/** The keyword that exports a declaration, by default or by name: a scope of its own keeps it. */
const EXPORT = /^export (default )?/gm;
/** An npm author's email and web page, left out: the name says who wrote it. */
const CONTACT = /\s*[<(][^>)]*[>)]/g;

/** What a template literal needs escaped to hold the text as it is. */
const escaped = (text: string) =>
  text.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");

const namesOf = (use: Kernel["use"]) => (typeof use === "string" ? [use] : use);

/**
 * A module's source without the imports the set already holds: names from a
 * package vendored before it in the set, which its scope sees. Any other
 * import is refused, since a worklet cannot load it.
 */
function withoutImports(
  source: string,
  where: string,
  held: ReadonlyMap<string, readonly string[]>
) {
  const body = source.replace(NAMED_IMPORT, (_line, list: string, from) => {
    const names = list.split(",").map((part) => part.trim());
    const has = held.get(from);
    if (!(has && names.every((imported) => has.includes(imported)))) {
      throw new Error(
        `${where} imports ${from}, which the set does not hold before it: a worklet cannot load it`
      );
    }
    return "";
  });
  if (IMPORT.test(body)) {
    throw new Error(
      `${where} imports another module: a worklet cannot load it`
    );
  }
  return body;
}

/** The file a set writes: each kernel's module as installed, in a scope of its own. */
export async function kernelFile({ constant, kernels }: KernelSet) {
  const held = new Map(
    kernels.map((kernel) => [kernel.name, namesOf(kernel.use)] as const)
  );
  const modules = await Promise.all(
    kernels.map(async ({ file, name, use }, index) => {
      const root = Bun.resolveSync(
        `${name}/package.json`,
        import.meta.dir
      ).replace(PACKAGE_JSON, "");
      const { author, license, version } = await Bun.file(
        `${root}package.json`
      ).json();
      const source = await Bun.file(`${root}${file}`).text();
      const before = new Map([...held].filter((_entry, at) => at < index));
      const body = withoutImports(source, `${name}/${file}`, before).replace(
        EXPORT,
        ""
      );
      const by = (typeof author === "string" ? author : author?.name)?.replace(
        CONTACT,
        ""
      );
      const names = namesOf(use);
      const given = typeof use === "string" ? use : `{ ${names.join(", ")} }`;
      return {
        code: `const ${given} = (() => {\n${body}\nreturn ${given};\n})();\n`,
        label: ` * - \`${name}\` ${version} (${license}, ${by}): ${names.map((each) => `\`${each}\``).join(", ")}`,
      };
    })
  );
  return `/**
 * audio.js kernels, each module as published, in its own scope, for an
 * \`AudioWorklet\`, which cannot import them:
${modules.map((module) => module.label).join("\n")}
 */
export const ${constant} = \`${escaped(modules.map((module) => module.code).join("\n"))}\`;
`;
}
