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
  /**
   * A module only the modules after it call, such as a package's own helpers:
   * its names stay in a constant of its own, which they take theirs from, so
   * a name two of them export does not clash.
   */
  internal?: boolean;
  name: string;
  /**
   * What the worklet calls, by the names the module exports it under, by
   * default or by name: one function, or several. For an internal module, what
   * the modules after it import.
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
    constant: "STUTTER_KERNELS",
    file: "devices/stutter/kernels.ts",
    kernels: [
      { file: "stutter.js", name: "@audio/effect-stutter", use: "stutter" },
    ],
  },
  {
    constant: "BINAURAL_PANNER_KERNELS",
    file: "devices/binaural-panner/kernels.ts",
    kernels: [
      { file: "binaural.js", name: "@audio/spatial-binaural", use: "binaural" },
    ],
  },
  {
    constant: "COMPRESSOR_KERNELS",
    file: "devices/compressor/kernels.ts",
    kernels: [
      {
        file: "util.js",
        from: "@audio/dynamics-vca",
        internal: true,
        name: "@audio/dynamics-envelope",
        use: "timeCoef",
      },
      {
        file: "envelope.js",
        from: "@audio/dynamics-vca",
        internal: true,
        name: "@audio/dynamics-envelope",
        use: "envelope",
      },
      {
        file: "util.js",
        from: "@audio/dynamics-vca",
        internal: true,
        name: "@audio/dynamics-compressor",
        use: ["writer", "concat", "db2lin", "lin2db"],
      },
      {
        file: "compressor.js",
        from: "@audio/dynamics-vca",
        internal: true,
        name: "@audio/dynamics-compressor",
        use: "compressorGain",
      },
      ...(["vca", "fet", "opto", "varimu"] as const).flatMap((model) => [
        {
          file: "util.js",
          internal: true,
          name: `@audio/dynamics-${model}`,
          use: ["writer", "concat", "db2lin", "lin2db", "timeCoef"],
        },
        {
          file: `${model}.js`,
          internal: true,
          name: `@audio/dynamics-${model}`,
          use: `${model}Stream`,
        },
        { file: "audio.js", name: `@audio/dynamics-${model}`, use: model },
      ]),
      {
        file: "util.js",
        internal: true,
        name: "@audio/dynamics-compressor",
        use: ["writer", "concat", "db2lin", "lin2db", "timeCoef"],
      },
      {
        file: "compressor.js",
        internal: true,
        name: "@audio/dynamics-compressor",
        use: ["compress", "compressorState"],
      },
      {
        file: "audio.js",
        name: "@audio/dynamics-compressor",
        use: "compressor",
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

/** What a vendored module gives the modules after it: its names, which one it exports by default, and for an internal one, the constant that holds them. */
interface Held {
  byDefault?: string;
  names: readonly string[];
  scope?: string;
}

/** The file an import loads, from the module at `path`, as the runtime resolves it: a package by the copy that module sees. Nothing, for one not installed where it looks. */
function resolved(specifier: string, path: string) {
  try {
    return Bun.resolveSync(specifier, path.slice(0, path.lastIndexOf("/")));
  } catch {
    return "";
  }
}

/** The names an import takes from a module, by the name each is exported under and the name it is given: each one the module gives. */
function namedOf(
  clause: string,
  module: Held,
  where: string,
  specifier: string
) {
  const named = NAMED_IMPORT.exec(clause);
  if (!named) {
    throw new Error(
      `${where} imports ${clause} from ${specifier}, a form the set cannot hold`
    );
  }
  const names = (named[1] ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [imported = "", local = imported] = part
        .split(" as ")
        .map((each) => each.trim());
      return { imported, local };
    });
  const missing = names.find(
    ({ imported }) => !module.names.includes(imported)
  );
  if (missing) {
    throw new Error(
      `${where} imports ${missing.imported} from ${specifier}, which the set does not take`
    );
  }
  return names;
}

/** What a module's scope declares for the names it imports: those of an internal module from the constant that holds them, an alias for one taken under another name. */
function aliasesOf(
  names: readonly { imported: string; local: string }[],
  module: Held
) {
  if (module.scope) {
    const parts = names.map(({ imported, local }) =>
      imported === local ? imported : `${imported}: ${local}`
    );
    return [`const { ${parts.join(", ")} } = ${module.scope};`];
  }
  return names.flatMap(({ imported, local }) =>
    local === imported ? [] : [`const ${local} = ${imported};`]
  );
}

/**
 * A module's source without the imports the set already holds: modules
 * vendored before it, by the file each import loads. The names of one in the
 * top scope it sees as they are, a default import under another name kept as
 * an alias; those of an internal one it takes from the constant that holds
 * them. Any other import is refused, since a worklet cannot load it.
 */
function withoutImports(
  source: string,
  where: string,
  path: string,
  held: ReadonlyMap<string, Held>
) {
  const aliases: string[] = [];
  const body = source.replace(
    IMPORT_STATEMENT,
    (_line, clause: string, specifier: string) => {
      const module = held.get(resolved(specifier, path));
      if (!module) {
        throw new Error(
          `${where} imports ${specifier}, which the set does not hold before it: a worklet cannot load it`
        );
      }
      const taken = clause.trim();
      if (DEFAULT_IMPORT.test(taken) && module.byDefault && !module.scope) {
        if (taken !== module.byDefault) {
          aliases.push(`const ${taken} = ${module.byDefault};`);
        }
        return "";
      }
      aliases.push(
        ...aliasesOf(namedOf(taken, module, where, specifier), module)
      );
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
      const path = `${root}${kernel.file}`;
      const source = await Bun.file(path).text();
      return { kernel, manifest, path, source };
    })
  );
  const held = new Map<string, Held>();
  const modules = read.map(({ kernel, manifest, path, source }, index) => {
    const { file, internal, name, use } = kernel;
    const body = withoutImports(source, `${name}/${file}`, path, held)
      .replace(EXPORT_LIST, "")
      .replace(EXPORT, "");
    const names = namesOf(use);
    const scope = internal ? `module${index}` : undefined;
    held.set(path, {
      byDefault: DEFAULT_EXPORT.exec(source)?.[1],
      names,
      scope,
    });
    const { author, license, version } = manifest;
    const by = (typeof author === "string" ? author : author?.name)?.replace(
      CONTACT,
      ""
    );
    const given = typeof use === "string" ? use : `{ ${names.join(", ")} }`;
    const code = scope
      ? `const ${scope} = (() => {\n${body}\nreturn { ${names.join(", ")} };\n})();\n`
      : `const ${given} = (() => {\n${body}\nreturn ${given};\n})();\n`;
    return {
      code,
      label: ` * - \`${name}\` ${version} (${license}, ${by}): ${names.map((each) => `\`${each}\``).join(", ")}${scope ? `, as \`${scope}\`` : ""}`,
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
