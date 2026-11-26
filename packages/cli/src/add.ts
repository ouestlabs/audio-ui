import { spawn } from "node:child_process";
import { join, relative } from "node:path";
import {
  readCssManifest,
  sheetElements,
  sheetSkins,
  writeSheets,
} from "./css.ts";
import {
  componentsFolder,
  needsUtils,
  rewriteImports,
  targetPath,
  UTILS,
  UTILS_PACKAGES,
  utilsPath,
  type Written,
  writeFile,
  written,
} from "./files.ts";
import {
  type Config,
  DEFAULT_STYLE,
  detect,
  detectPackageManager,
  type Framework,
  installedPackages,
  type PackageManager,
  readConfig,
  writeConfig,
} from "./project.ts";
import {
  DEFAULT_REGISTRY,
  itemFor,
  Registry,
  type RegistryItem,
  reactItems,
  resolveTree,
} from "./registry.ts";

export interface AddOptions {
  cwd: string;
  /** Overrides the framework found in the project, and is kept. */
  framework?: Framework;
  /** The headless primitive alone, with no style: `<name>-<framework>`. */
  headless?: boolean;
  /** Runs the package manager for the packages the files import; off, the command is returned. */
  install?: boolean;
  names: string[];
  /** Replaces a file of the project that differs from the registry's. */
  overwrite?: boolean;
  /** The registry's site, or a folder that holds a copy of it. */
  registry?: string;
  /** Overrides the style found in `audio-ui.json`, and is kept. */
  style?: string;
}

export interface AddResult {
  config: Config;
  /** Whether `audio-ui.json` was written by this add. */
  configCreated: boolean;
  /** The items of other registries the files import, such as `@shadcn/button`: the project adds them itself. */
  external: string[];
  files: Written;
  /** The index of the sheets, when the add wrote one: imported once at the app's root. */
  index?: string;
  /** The command that installs the packages, when `install` is off or it failed. */
  installCommand?: string;
  /** The items written, each after the ones it needs. */
  items: string[];
  /** The packages the files import that the project lacked. */
  packages: string[];
  /** Package specs the registry gave that are not an npm name and version: never passed to the package manager. */
  refused: string[];
}

// A package's name never starts with a dot, so a relative import is not one.
const BARE_IMPORT =
  /(?:from|import)\s*\(?\s*["']((?:@[\w.-]+\/)?[\w-][^"']*)["']/g;

/** The packages a set of files imports: the bare specifiers, by their package's name. */
export function importedPackages(files: { content?: string }[]) {
  const names = new Set<string>();
  for (const file of files) {
    for (const [, specifier = ""] of (file.content ?? "").matchAll(
      BARE_IMPORT
    )) {
      const parts = specifier.split("/");
      const name = specifier.startsWith("@")
        ? parts.slice(0, 2).join("/")
        : (parts[0] ?? "");
      if (name && !name.startsWith("node:") && !name.includes(":")) {
        names.add(name);
      }
    }
  }
  return names;
}

/** A package's name, without the version a spec pins: `@ui-sdk/core@0.1.0` is `@ui-sdk/core`. */
export const packageName = (spec: string) =>
  spec.startsWith("@")
    ? `@${spec.slice(1).split("@")[0]}`
    : (spec.split("@")[0] ?? spec);

/**
 * An npm package's name, scoped or not, with an exact version at most. The
 * specs come from the registry, read over the network, and become a command's
 * arguments: one that could be an option (`--registry=…`) or carry a
 * character a shell reads (Windows runs the command through one) is refused.
 */
const PACKAGE_SPEC =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[0-9a-z][0-9a-z.+-]*)?$/i;

export const isPackageSpec = (spec: string) => PACKAGE_SPEC.test(spec);

const ADD_COMMAND: Record<PackageManager, string[]> = {
  bun: ["bun", "add"],
  npm: ["npm", "install"],
  pnpm: ["pnpm", "add"],
  yarn: ["yarn", "add"],
};

function run(command: string[], cwd: string) {
  return new Promise<boolean>((done) => {
    const [bin = "npm", ...args] = command;
    const child = spawn(bin, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    child.on("close", (code) => done(code === 0));
    child.on("error", () => done(false));
  });
}

/** The project's config: the one kept in `audio-ui.json`, else what the CLI finds, with the options given over it. */
function configOf(options: AddOptions) {
  const kept = readConfig(options.cwd);
  const config: Config = {
    ...(kept ?? detect(options.cwd, options.style ?? DEFAULT_STYLE)),
    ...(options.framework ? { framework: options.framework } : {}),
    ...(options.style ? { style: options.style } : {}),
  };
  return { config, kept: kept !== undefined };
}

/** The items to write, each after the items it needs, with what they need from other registries. */
async function treeOf(registry: Registry, config: Config, options: AddOptions) {
  const roots = await Promise.all(
    options.names.map((name) =>
      itemFor(registry, name, config.framework, options.headless ?? false)
    )
  );
  const tree = await resolveTree(registry, roots);
  const react = config.framework === "react" ? [] : reactItems(tree.items);
  if (react.length > 0) {
    throw new Error(
      `${react.join(", ")} ${react.length > 1 ? "are" : "is"} written for React, and the project is ${config.framework}.`
    );
  }
  return tree;
}

/** Writes the items' files where the project keeps them, their imports as it resolves them. */
function writeItems(
  items: RegistryItem[],
  config: Config,
  options: AddOptions,
  report: Written
) {
  const { cwd } = options;
  // A file several items ship (the primitives' shared `primitive.ts`) is written once.
  const files = new Map<string, string>();
  for (const file of items.flatMap((item) => item.files ?? [])) {
    const path = targetPath(file, config, cwd);
    files.set(path, rewriteImports(file.content ?? "", path, config, cwd));
  }
  for (const [path, content] of files) {
    writeFile(path, content, cwd, options.overwrite ?? false, report);
  }
}

/**
 * The packages the items need: the ones they declare, with their pinned
 * versions, any other one their files import, and `cn`'s when the CLI writes
 * it for a React project that has none.
 */
function packagesOf(
  items: RegistryItem[],
  config: Config,
  cwd: string,
  report: Written
) {
  const files = items.flatMap((item) => item.files ?? []);
  const packages = new Set(items.flatMap((item) => item.dependencies ?? []));
  const declared = new Set([...packages].map(packageName));
  for (const name of importedPackages(files)) {
    if (!declared.has(name)) {
      packages.add(name);
    }
  }
  const utils = utilsPath(config, cwd);
  if (config.framework === "react" && needsUtils(files) && !utils.exists) {
    writeFile(utils.path, UTILS, cwd, false, report);
    for (const name of UTILS_PACKAGES) {
      packages.add(name);
    }
  }
  return packages;
}

/**
 * The sheets of a tree and their index: outside React, the styled elements'
 * and the theme's tokens when the project has none; in every framework, the
 * skins'. A headless add has no style, so no sheet.
 */
async function sheetsOf(
  items: RegistryItem[],
  config: Config,
  options: AddOptions,
  report: Written
) {
  if (options.headless) {
    return;
  }
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const manifest = await readCssManifest(registry);
  const react = config.framework === "react";
  const elements = react
    ? []
    : sheetElements(items, config.framework, manifest);
  const skins = sheetSkins(items, manifest);
  if (elements.length + skins.length === 0) {
    return;
  }
  const theme = !react && config.theme ? ["theme"] : [];
  const index = await writeSheets(
    registry,
    config,
    [...theme, ...elements, ...skins],
    join(componentsFolder(config, options.cwd), "css"),
    options.cwd,
    options.overwrite ?? false,
    report
  );
  return relative(options.cwd, index);
}

/** Installs the packages the project lacks; returns the command when it was not run, or failed, and the specs it refused. */
async function install(
  packages: Set<string>,
  cwd: string,
  enabled: boolean | undefined
) {
  const installed = installedPackages(cwd);
  const needed = [...packages].filter(
    (spec) => !installed.has(packageName(spec))
  );
  const missing = needed.filter(isPackageSpec);
  const refused = needed.filter((spec) => !isPackageSpec(spec));
  if (missing.length === 0) {
    return { missing, refused };
  }
  const command = [...ADD_COMMAND[detectPackageManager(cwd)], ...missing];
  const ok = enabled !== false && (await run(command, cwd));
  return { command: ok ? undefined : command.join(" "), missing, refused };
}

export async function add(options: AddOptions): Promise<AddResult> {
  const { config, kept } = configOf(options);
  const registry = new Registry(
    options.registry ?? DEFAULT_REGISTRY,
    config.style
  );
  const tree = await treeOf(registry, config, options);
  const report = written();
  writeItems(tree.items, config, options, report);
  const packages = packagesOf(tree.items, config, options.cwd, report);
  const index = await sheetsOf(tree.items, config, options, report);
  const { command, missing, refused } = await install(
    packages,
    options.cwd,
    options.install
  );
  if (!kept || options.framework || options.style) {
    writeConfig(options.cwd, config);
  }
  return {
    config,
    configCreated: !kept,
    external: tree.external,
    files: report,
    index,
    installCommand: command,
    items: tree.items.map((item) => item.name),
    packages: missing,
    refused,
  };
}
