import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const FRAMEWORKS = ["react", "vue", "svelte", "web"] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const isFramework = (value: unknown): value is Framework =>
  FRAMEWORKS.includes(value as Framework);

/** What the CLI knows of a project, kept in `audio-ui.json` at its root. */
export interface Config {
  /** The import alias that points at `root`, such as `@`, or `$lib` in SvelteKit. Without one, the files import each other by relative paths. */
  alias?: string;
  /** The framework the files are written for. */
  framework: Framework;
  /** The folder the alias points at, from the project's root: `src` or `.`. */
  root: string;
  /** The style the components are drawn in, such as `nova`. */
  style: string;
  /** Whether the theme's tokens come with the sheets: off when the project has a shadcn theme. */
  theme: boolean;
}

export const CONFIG_FILE = "audio-ui.json";
export const DEFAULT_STYLE = "nova";

// A string, which stays as it is, or what plain JSON lacks: a comment, or a comma before a closing bracket.
const LOOSE_JSON =
  /"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\/|,(?=\s*[}\]])/g;

/** JSON as tsconfig writes it, with comments and trailing commas. */
export function parseLooseJson(text: string): unknown {
  return JSON.parse(
    text.replace(LOOSE_JSON, (token) => (token.startsWith('"') ? token : ""))
  );
}

function readJson(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) {
    return;
  }
  try {
    const value = parseLooseJson(readFileSync(path, "utf8"));
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    // A file that does not parse tells nothing of the project.
  }
}

/** The framework a project is written in, from its dependencies: a project that uses none is plain web. */
export function detectFramework(cwd: string): Framework {
  const pkg = readJson(join(cwd, "package.json")) ?? {};
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  if ("svelte" in deps || "@sveltejs/kit" in deps) {
    return "svelte";
  }
  if ("vue" in deps || "nuxt" in deps) {
    return "vue";
  }
  if ("react" in deps) {
    return "react";
  }
  return "web";
}

const TSCONFIGS = [
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.web.json",
  "jsconfig.json",
];
const WILDCARD = /\/\*$/;

/** The import alias that points at `root` in the project's tsconfig paths, if it declares one. */
export function detectAlias(cwd: string, root: string): string | undefined {
  const folder = root === "." ? "./*" : `./${root}/*`;
  for (const name of TSCONFIGS) {
    const options = readJson(join(cwd, name))?.compilerOptions as
      | { paths?: Record<string, string[]> }
      | undefined;
    for (const [alias, targets] of Object.entries(options?.paths ?? {})) {
      if (targets.includes(folder) || targets.includes(folder.slice(2))) {
        return alias.replace(WILDCARD, "");
      }
    }
  }
}

const hasPackage = (cwd: string, name: string) => {
  const pkg = readJson(join(cwd, "package.json")) ?? {};
  return [pkg.dependencies, pkg.devDependencies].some(
    (deps) => typeof deps === "object" && deps !== null && name in deps
  );
};

/** SvelteKit gives every project `$lib`, the folder the Svelte files land in; Svelte alone has none. */
const svelteAlias = (cwd: string) =>
  hasPackage(cwd, "@sveltejs/kit") ? "$lib" : undefined;

/** What the CLI finds of a project with no `audio-ui.json`: what it writes there on the first add. */
export function detect(cwd: string, style: string): Config {
  const root = existsSync(join(cwd, "src")) ? "src" : ".";
  const framework = detectFramework(cwd);
  return {
    alias: framework === "svelte" ? svelteAlias(cwd) : detectAlias(cwd, root),
    framework,
    root,
    style,
    // shadcn's init writes components.json and the theme's tokens: the project has them.
    theme: !existsSync(join(cwd, "components.json")),
  };
}

export function readConfig(cwd: string): Config | undefined {
  const config = readJson(join(cwd, CONFIG_FILE));
  return config && isFramework(config.framework)
    ? (config as unknown as Config)
    : undefined;
}

export function writeConfig(cwd: string, config: Config) {
  writeFileSync(join(cwd, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

const LOCKFILES: [string, PackageManager][] = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

/** The package manager of a project: its lockfile, here or in a workspace above, else the one running the CLI. */
export function detectPackageManager(cwd: string): PackageManager {
  for (let dir = cwd; ; dir = dirname(dir)) {
    for (const [file, manager] of LOCKFILES) {
      if (existsSync(join(dir, file))) {
        return manager;
      }
    }
    if (dirname(dir) === dir) {
      break;
    }
  }
  const agent = process.env.npm_config_user_agent ?? "";
  return (
    (["bun", "pnpm", "yarn"] as const).find((manager) =>
      agent.startsWith(manager)
    ) ?? "npm"
  );
}

/** The packages a project already depends on, by name. */
export function installedPackages(cwd: string): Set<string> {
  const pkg = readJson(join(cwd, "package.json")) ?? {};
  return new Set([
    ...Object.keys((pkg.dependencies as object | undefined) ?? {}),
    ...Object.keys((pkg.devDependencies as object | undefined) ?? {}),
  ]);
}
