import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Written, writeFile } from "./files.ts";
import type { Config, Framework } from "./project.ts";
import { type RegistryItem, readRegistryFile } from "./registry.ts";

/** What the registry serves as plain CSS: the elements that have a sheet, and the styles each is drawn in. */
export interface CssManifest {
  elements: string[];
  styles: string[];
}

export async function readCssManifest(registry: string): Promise<CssManifest> {
  const text = await readRegistryFile(registry, "/css/index.json");
  return text
    ? (JSON.parse(text) as CssManifest)
    : { elements: [], styles: [] };
}

/** The elements of a tree its sheets draw: a styled component of Vue or Svelte, a custom element in plain web. */
export function sheetElements(
  items: RegistryItem[],
  framework: Framework,
  manifest: CssManifest
): string[] {
  const suffix = framework === "web" ? "-web" : `-element-${framework}`;
  return items
    .map((item) => item.name)
    .filter((name) => name.endsWith(suffix))
    .map((name) => name.slice(0, -suffix.length))
    .filter((element) => manifest.elements.includes(element));
}

const IMPORT_LINE = /@import\s+["']\.\/([\w-]+)\.css["']/g;

/** The index that gathers the sheets: the theme's tokens first, then each element, keeping what is already there. */
export function indexSheet(current: string, sheets: string[]) {
  const listed = new Set(
    [...current.matchAll(IMPORT_LINE)].map(([, name]) => name)
  );
  const missing = sheets.filter((sheet) => !listed.has(sheet));
  if (missing.length === 0) {
    return current;
  }
  const lines = missing.map((sheet) => `@import "./${sheet}.css";`);
  return current
    ? `${current.trimEnd()}\n${lines.join("\n")}\n`
    : `/* The sheets of the audio/ui components: import this file once, at the root of the app. */\n${lines.join("\n")}\n`;
}

/** Writes the sheets of the elements, the theme's tokens when the project has none, and the index that imports them. */
export async function writeSheets(
  registry: string,
  config: Config,
  elements: string[],
  folder: string,
  cwd: string,
  overwrite: boolean,
  report: Written
) {
  const sheets = [...(config.theme ? ["theme"] : []), ...elements];
  const contents = await Promise.all(
    sheets.map((sheet) =>
      readRegistryFile(
        registry,
        sheet === "theme"
          ? "/css/theme.css"
          : `/css/${config.style}/${sheet}.css`
      )
    )
  );
  for (const [position, sheet] of sheets.entries()) {
    const content = contents[position];
    if (content === undefined) {
      throw new Error(
        `The registry has no sheet "${sheet}" in "${config.style}".`
      );
    }
    writeFile(join(folder, `${sheet}.css`), content, cwd, overwrite, report);
  }
  const index = join(folder, "index.css");
  const current = existsSync(index) ? readFileSync(index, "utf8") : "";
  // The index is ours to extend: it gains the sheets it lacks, whatever was written in it.
  writeFile(index, indexSheet(current, sheets), cwd, true, report);
  return index;
}
