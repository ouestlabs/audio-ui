import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Config } from "./project.ts";
import type { RegistryFile } from "./registry.ts";

const UNSAFE = /\.\.|^[a-zA-Z]:[\\/]|%2e|%00/i;
const hasControlCharacter = (text: string) =>
  [...text].some((char) => (char.codePointAt(0) ?? 0) < 32);

/**
 * Where a file of the registry lands in the project: `~/` from its root, else
 * from the folder its alias points at. A target that would leave the project
 * (`..`, an absolute path, an encoded one) is refused, as the registry is read
 * over the network.
 */
export function targetPath(file: RegistryFile, config: Config, cwd: string) {
  const { target } = file;
  if (
    !target ||
    UNSAFE.test(target) ||
    hasControlCharacter(target) ||
    isAbsolute(target)
  ) {
    throw new Error(`Refused the target "${target ?? file.path}".`);
  }
  const path = target.startsWith("~/")
    ? resolve(cwd, target.slice(2))
    : resolve(cwd, config.root, target);
  const root = resolve(cwd);
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error(`Refused the target "${target}": it leaves the project.`);
  }
  return path;
}

const REGISTRY_IMPORT =
  /((?:from|import)\s*\(?\s*["'])(@|\$lib)\/([^"']+)(["'])/g;

/**
 * A file's imports of the registry's other files as the project resolves
 * them. The registry writes them `@/` (from the alias's folder) or `$lib/`
 * (Svelte's `src/lib`): with the project's alias when it has one, else as a
 * relative path from the file.
 */
export function rewriteImports(
  content: string,
  file: string,
  config: Config,
  cwd: string
) {
  return content.replace(
    REGISTRY_IMPORT,
    (_match, start: string, prefix: string, rest: string, end: string) => {
      const svelte = prefix === "$lib";
      if (config.alias && (config.alias === "$lib") === svelte) {
        return `${start}${config.alias}/${rest}${end}`;
      }
      const target = svelte
        ? join(cwd, "src/lib", rest)
        : join(cwd, config.root, rest);
      const path = relative(dirname(file), target).split(sep).join("/");
      return `${start}${path.startsWith(".") ? path : `./${path}`}${end}`;
    }
  );
}

export interface Written {
  /** Written. */
  created: string[];
  /** Already there with another content, and left as it was. */
  kept: string[];
  /** Already there, with the same content. */
  same: string[];
}

export const written = (): Written => ({ created: [], kept: [], same: [] });

/** Writes a file unless it is already there: the same content is skipped, another one is kept unless `overwrite`. */
export function writeFile(
  path: string,
  content: string,
  cwd: string,
  overwrite: boolean,
  report: Written
) {
  const name = relative(cwd, path);
  if (existsSync(path)) {
    const current = readFileSync(path, "utf8");
    if (current === content) {
      report.same.push(name);
      return;
    }
    if (!overwrite) {
      report.kept.push(name);
      return;
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  report.created.push(name);
}

/** The folder that holds the components, where the registry's `components/audio-ui/` lands. */
export const componentsFolder = (config: Config, cwd: string) =>
  config.framework === "svelte"
    ? join(cwd, "src/lib/components/audio-ui")
    : join(cwd, config.root, "components/audio-ui");

/** What React's styled components import as `cn`: written once, when a component needs it and the project has none. `cn` merges Tailwind classes as clsx and tailwind-merge do. */
export const UTILS = `export { cn } from "cn";
`;

export const UTILS_PACKAGES = ["cn"];

const UTILS_IMPORT = /from\s+["']@\/lib\/utils["']/;

export const needsUtils = (files: RegistryFile[]) =>
  files.some((file) => UTILS_IMPORT.test(file.content ?? ""));

/** Where the project keeps `cn`, if it does: a shadcn project has it. */
export function utilsPath(config: Config, cwd: string) {
  const base = join(cwd, config.root, "lib/utils");
  const existing = [".ts", ".tsx", ".js"].find((extension) =>
    existsSync(`${base}${extension}`)
  );
  return { exists: existing !== undefined, path: `${base}.ts` };
}
