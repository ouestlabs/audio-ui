import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { type AddResult, add } from "./add.ts";
import { readCssManifest } from "./css.ts";
import {
  CONFIG_FILE,
  DEFAULT_STYLE,
  FRAMEWORKS,
  isFramework,
  readConfig,
} from "./project.ts";
import { DEFAULT_REGISTRY } from "./registry.ts";

const HELP = `audio-ui ${pkg.version}

Adds audio/ui components to a project: the files are copied in, and they are yours.

Usage
  npx audio-ui add <name...> [options]

Options
  --headless           the primitive alone, with no style
  --framework <name>   ${FRAMEWORKS.join(", ")} (found in package.json)
  --style <name>       the style to draw the components in (nova by default)
  --overwrite          replace the files of the project that differ
  --no-install         print the package manager's command instead of running it
  --cwd <dir>          the project's root (the current folder)
  --registry <url>     another registry, or a folder holding a copy of one
  -h, --help           this help
  -v, --version        the version

The framework, the style and the import alias are kept in ${CONFIG_FILE}.
Docs: https://www.audio-ui.dev/docs/cli`;

/** The style to draw the components in, asked on the first add when a person runs it. */
async function askStyle(registry: string) {
  const { styles } = await readCssManifest(registry);
  if (!(process.stdin.isTTY && styles.length > 1)) {
    return DEFAULT_STYLE;
  }
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await prompt.question(
    `Which style? ${styles.join(", ")} (${DEFAULT_STYLE}) `
  );
  prompt.close();
  const style = answer.trim();
  return styles.includes(style) ? style : DEFAULT_STYLE;
}

function print(result: AddResult) {
  const { config, files } = result;
  if (result.configCreated) {
    console.log(
      `Wrote ${CONFIG_FILE}: ${config.framework}, the ${config.style} style, ${config.alias ? `imports from "${config.alias}/"` : "relative imports"}.`
    );
  }
  for (const file of files.created) {
    console.log(`  + ${file}`);
  }
  if (files.same.length > 0) {
    console.log(`  ${files.same.length} file(s) already up to date.`);
  }
  for (const file of files.kept) {
    console.log(
      `  ! ${file} differs from the registry's: kept (--overwrite replaces it)`
    );
  }
  if (result.packages.length > 0 && !result.installCommand) {
    console.log(`Installed ${result.packages.join(", ")}.`);
  }
  if (result.installCommand) {
    console.log(
      `\nInstall the packages the files import:\n  ${result.installCommand}`
    );
  }
  if (result.index) {
    console.log(
      `\nThe components are drawn by plain CSS. Import this once, at the root of the app:\n  ${result.index}`
    );
  }
  if (result.external.length > 0) {
    console.log(
      `\nThese come from shadcn's registry. Add them with:\n  npx shadcn@latest add ${result.external.join(" ")}`
    );
  }
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      cwd: { type: "string" },
      framework: { type: "string" },
      headless: { type: "boolean" },
      help: { short: "h", type: "boolean" },
      "no-install": { type: "boolean" },
      overwrite: { type: "boolean" },
      registry: { type: "string" },
      style: { type: "string" },
      version: { short: "v", type: "boolean" },
    },
  });
  if (values.version) {
    console.log(pkg.version);
    return;
  }
  const [command, ...names] = positionals;
  if (values.help || command !== "add" || names.length === 0) {
    console.log(HELP);
    process.exitCode = values.help || !command ? 0 : 1;
    return;
  }
  if (values.framework !== undefined && !isFramework(values.framework)) {
    throw new Error(
      `--framework is one of ${FRAMEWORKS.join(", ")}, not "${values.framework}".`
    );
  }
  const cwd = values.cwd ?? process.cwd();
  const registry = values.registry ?? DEFAULT_REGISTRY;
  const style =
    values.style ?? (readConfig(cwd) ? undefined : await askStyle(registry));
  print(
    await add({
      cwd,
      framework: values.framework,
      headless: values.headless,
      install: !values["no-install"],
      names,
      overwrite: values.overwrite,
      registry,
      style,
    })
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
