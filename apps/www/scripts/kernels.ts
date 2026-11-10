// The audio.js kernels each device runs in an AudioWorklet, and the file that
// carries them: a worklet cannot import, so a device holds their code as
// published, in a string. `build-kernels.ts` writes the files, and
// `test/kernels.test.ts` fails when one no longer matches the packages.

interface Kernel {
  /** The module that holds it, in the package. */
  file: string;
  /**
   * The package whose folder finds this one, for a package the device does
   * not install itself but one of its kernels depends on.
   */
  from?: string;
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
    constant: "ROTARY_KERNELS",
    file: "devices/rotary/kernels.ts",
    kernels: [
      {
        file: "core/transform.js",
        from: "@audio/eq-crossover",
        name: "digital-filter",
        use: "polesSos",
      },
      {
        file: "iir/butterworth.js",
        from: "@audio/eq-crossover",
        name: "digital-filter",
        use: "butterworth",
      },
      {
        file: "iir/linkwitz-riley.js",
        from: "@audio/eq-crossover",
        name: "digital-filter",
        use: "linkwitzRiley",
      },
      { file: "crossover.js", name: "@audio/eq-crossover", use: "crossover" },
      { file: "biquad.js", name: "@audio/biquad", use: ["step", "state"] },
      { file: "rotary.js", name: "@audio/effect-rotary", use: "rotary" },
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
/** An import statement: what it takes, and from where. */
const IMPORT_STATEMENT =
  /^\s*import\s+(.+?)\s+from\s*["']([^"']+)["'];?[ \t]*\n?/gm;
const DEFAULT_IMPORT = /^[A-Za-z_$][\w$]*$/;
const NAMED_IMPORT = /^\{([^}]*)\}$/;
const DEFAULT_EXPORT = /export default function ([A-Za-z_$][\w$]*)/;
/** A list of names a module exports, `export { a as b }`: its scope keeps them, so the line goes. */
const EXPORT_LIST = /^export\s*\{[^}]*\};?[ \t]*\n?/gm;
/** The keyword that exports a declaration, by default or by name: a scope of its own keeps it. */
const EXPORT = /^export (default )?/gm;
/** An npm author's email and web page, left out: the name says who wrote it. */
const CONTACT = /\s*[<(][^>)]*[>)]/g;

/** What a template literal needs escaped to hold the text as it is. */
const escaped = (text: string) =>
  text.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");

const namesOf = (use: Kernel["use"]) => (typeof use === "string" ? [use] : use);

/** A module's path in its package, with `.` and `..` worked out. */
function normalized(path: string) {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }
  return parts.join("/");
}

/** What a vendored module gives the modules after it: its names, and which one it exports by default. */
interface Held {
  byDefault?: string;
  name: string;
  names: readonly string[];
}

/** The module an import names: one of the package's own by its path, or another package, by a path in it or by its name. */
function heldFor(
  specifier: string,
  { file, name }: Pick<Kernel, "file" | "name">,
  held: ReadonlyMap<string, Held>
) {
  if (specifier.startsWith(".")) {
    const folder = file.split("/").slice(0, -1).join("/");
    return held.get(`${name}/${normalized(`${folder}/${specifier}`)}`);
  }
  return (
    held.get(specifier) ??
    [...held.values()].find((module) => module.name === specifier)
  );
}

/**
 * A module's source without the imports the set already holds: modules
 * vendored before it, whose names its scope sees, a default import under
 * another name kept as an alias. Any other import is refused, since a worklet
 * cannot load it.
 */
function withoutImports(
  source: string,
  kernel: Pick<Kernel, "file" | "name">,
  held: ReadonlyMap<string, Held>
) {
  const where = `${kernel.name}/${kernel.file}`;
  const aliases: string[] = [];
  const body = source.replace(
    IMPORT_STATEMENT,
    (_line, clause: string, specifier: string) => {
      const module = heldFor(specifier, kernel, held);
      if (!module) {
        throw new Error(
          `${where} imports ${specifier}, which the set does not hold before it: a worklet cannot load it`
        );
      }
      const named = NAMED_IMPORT.exec(clause.trim());
      if (DEFAULT_IMPORT.test(clause.trim()) && module.byDefault) {
        if (clause.trim() !== module.byDefault) {
          aliases.push(`const ${clause.trim()} = ${module.byDefault};`);
        }
        return "";
      }
      for (const part of named?.[1]?.split(",") ?? []) {
        const [imported = "", local = imported] = part
          .split(" as ")
          .map((each) => each.trim());
        if (!module.names.includes(imported)) {
          throw new Error(
            `${where} imports ${imported} from ${specifier}, which the set does not take`
          );
        }
        if (local !== imported) {
          aliases.push(`const ${local} = ${imported};`);
        }
      }
      if (!named) {
        throw new Error(
          `${where} imports ${clause} from ${specifier}, a form the set cannot hold`
        );
      }
      return "";
    }
  );
  if (IMPORT.test(body)) {
    throw new Error(
      `${where} imports another module: a worklet cannot load it`
    );
  }
  return [...aliases, body].join("\n");
}

/** Where a package is installed: by its manifest, or, when it does not export that, by the module wanted. */
function rootOf(name: string, file: string, base: string) {
  try {
    return Bun.resolveSync(`${name}/package.json`, base).replace(
      PACKAGE_JSON,
      ""
    );
  } catch {
    const path = Bun.resolveSync(`${name}/${file}`, base);
    return path.slice(0, path.length - file.length);
  }
}

/** The file a set writes: each kernel's module as installed, in a scope of its own. */
export async function kernelFile({ constant, kernels }: KernelSet) {
  const read = await Promise.all(
    kernels.map(async (kernel) => {
      const base = kernel.from
        ? rootOf(kernel.from, "package.json", import.meta.dir)
        : import.meta.dir;
      const root = rootOf(kernel.name, kernel.file, base);
      const manifest = await Bun.file(`${root}package.json`).json();
      const source = await Bun.file(`${root}${kernel.file}`).text();
      return { kernel, manifest, source };
    })
  );
  const held = new Map<string, Held>();
  const modules = read.map(({ kernel, manifest, source }) => {
    const { file, name, use } = kernel;
    const body = withoutImports(source, kernel, held)
      .replace(EXPORT_LIST, "")
      .replace(EXPORT, "");
    held.set(`${name}/${file}`, {
      byDefault: DEFAULT_EXPORT.exec(source)?.[1],
      name,
      names: namesOf(use),
    });
    const { author, license, version } = manifest;
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
  });
  return `/**
 * audio.js kernels, each module as published, in its own scope, for an
 * \`AudioWorklet\`, which cannot import them:
${modules.map((module) => module.label).join("\n")}
 */
export const ${constant} = \`${escaped(modules.map((module) => module.code).join("\n"))}\`;
`;
}
