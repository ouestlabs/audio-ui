// Writes `lib/filter-ladders.ts`: the ladder kernels of the installed
// `@audio/filter-*` packages, as published, in a string an AudioWorklet can
// run, since a worklet cannot import. Run it after bumping one of them; the
// filter tests fail until it is run.

const PACKAGES = [
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
] as const;

const PACKAGE_JSON = /package\.json$/;
const OUT = `${import.meta.dir}/../src/registry-audio/bases/base/lib/filter-ladders.ts`;

/** What a template literal needs escaped to hold the text as it is. */
const escaped = (text: string) =>
  text.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");

const modules = await Promise.all(
  PACKAGES.map(async ({ file, name, use }) => {
    const root = Bun.resolveSync(
      `${name}/package.json`,
      import.meta.dir
    ).replace(PACKAGE_JSON, "");
    const { version } = await Bun.file(`${root}package.json`).json();
    const source = await Bun.file(`${root}${file}`).text();
    // Each module in a scope of its own: they all take `tan`, `tanh`, `PI` and `min` out of Math.
    const body = source.replace(
      `export default function ${use}`,
      `function ${use}`
    );
    return {
      code: `const ${use} = (() => {\n${body}\nreturn ${use};\n})();\n`,
      label: `\`${name}\` ${version}`,
    };
  })
);

const labels = modules.map((module) => module.label);
await Bun.write(
  OUT,
  `/**
 * The ladder kernels of ${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}
 * (MIT, Dmitry Iv.), each module as published, in its own scope, for an
 * \`AudioWorklet\`: a worklet cannot import them. It defines \`moogLadder\`,
 * \`diodeLadder\` and \`korg35\`.
 */
export const LADDER_KERNELS = \`${escaped(modules.map((module) => module.code).join("\n"))}\`;
`
);
console.log(`Wrote ${OUT}`);
