// The audio.js kernels each device runs in an AudioWorklet, and the file that
// carries them: a worklet cannot import, so a device holds their code as
// published, in a string. `build-kernels.ts` writes the files, and
// `test/kernels.test.ts` fails when one no longer matches the packages.

interface Kernel {
  /** The module that holds it, in the package. */
  file: string;
  name: string;
  /** The function it exports by default, the name the worklet calls it by. */
  use: string;
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
/** An npm author's email and web page, left out: the name says who wrote it. */
const CONTACT = /\s*[<(][^>)]*[>)]/g;

/** What a template literal needs escaped to hold the text as it is. */
const escaped = (text: string) =>
  text.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");

/** The file a set writes: each kernel's module as installed, in a scope of its own. */
export async function kernelFile({ constant, kernels }: KernelSet) {
  const modules = await Promise.all(
    kernels.map(async ({ file, name, use }) => {
      const root = Bun.resolveSync(
        `${name}/package.json`,
        import.meta.dir
      ).replace(PACKAGE_JSON, "");
      const { author, license, version } = await Bun.file(
        `${root}package.json`
      ).json();
      const source = await Bun.file(`${root}${file}`).text();
      if (IMPORT.test(source)) {
        throw new Error(
          `${name}/${file} imports another module: a worklet cannot load it`
        );
      }
      const body = source.replace(
        `export default function ${use}`,
        `function ${use}`
      );
      const by = (typeof author === "string" ? author : author?.name)?.replace(
        CONTACT,
        ""
      );
      return {
        code: `const ${use} = (() => {\n${body}\nreturn ${use};\n})();\n`,
        label: ` * - \`${name}\` ${version} (${license}, ${by}): \`${use}\``,
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
