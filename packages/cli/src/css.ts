import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Written, writeFile } from "./files.ts";
import type { Config, Framework } from "./project.ts";
import { type RegistryItem, readRegistryFile } from "./registry.ts";

/** What the registry serves as plain CSS: the elements that have a sheet, the styles each is drawn in, and the skins. */
export interface CssManifest {
  elements: string[];
  skins?: string[];
  styles: string[];
}

export async function readCssManifest(registry: string): Promise<CssManifest> {
  const text = await readRegistryFile(registry, "/css/index.json");
  return text
    ? (JSON.parse(text) as CssManifest)
    : { elements: [], skins: [], styles: [] };
}

/**
 * The elements of a tree its sheets draw: a styled component of Vue or
 * Svelte, a custom element in plain web, or the adapter of a kit drawn from
 * its sheet alone (the plot's parts, the waveform's), each element once.
 */
export function sheetElements(
  items: RegistryItem[],
  framework: Framework,
  manifest: CssManifest
): string[] {
  const suffixes =
    framework === "web" ? ["-web"] : [`-element-${framework}`, `-${framework}`];
  const elements = items.flatMap((item) => {
    const suffix = suffixes.find((each) => item.name.endsWith(each));
    return suffix ? [item.name.slice(0, -suffix.length)] : [];
  });
  return [...new Set(elements)].filter((element) =>
    manifest.elements.includes(element)
  );
}

/** The skins of a tree, as their sheets: `skin-neu` is the Neu skin's, the same in every framework. */
export function sheetSkins(
  items: RegistryItem[],
  manifest: CssManifest
): string[] {
  return items
    .map((item) => item.name)
    .filter(
      (name) =>
        name.startsWith(SKIN) &&
        (manifest.skins ?? []).includes(name.slice(SKIN.length))
    );
}

const SKIN = "skin-";
const IMPORT_LINE = /@import\s+["']\.\/([\w-]+)\.css["']/g;
const SKIN_IMPORT = /^@import\s+["']\.\/skin-[\w-]+\.css["'];?$/m;

const importOf = (sheet: string) => `@import "./${sheet}.css";`;

/**
 * The index that gathers the sheets: the theme's tokens first, then each
 * element, then the skins, keeping what is already there. A skin's rules weigh
 * as much as an element's, so a sheet added later still goes before the skins.
 */
export function indexSheet(current: string, sheets: string[]) {
  const listed = new Set(
    [...current.matchAll(IMPORT_LINE)].map(([, name]) => name)
  );
  const missing = sheets.filter((sheet) => !listed.has(sheet));
  if (missing.length === 0) {
    return current;
  }
  const skins = missing.filter((sheet) => sheet.startsWith(SKIN));
  const others = missing.filter((sheet) => !sheet.startsWith(SKIN));
  if (!current) {
    return `/* The sheets of the audio/ui components: import this file once, at the root of the app. */\n${[...others, ...skins].map(importOf).join("\n")}\n`;
  }
  const firstSkin = SKIN_IMPORT.exec(current)?.index ?? -1;
  const body = current.trimEnd();
  const before = firstSkin < 0 ? body : body.slice(0, firstSkin).trimEnd();
  const after = firstSkin < 0 ? "" : body.slice(firstSkin);
  return `${[before, ...others.map(importOf), after, ...skins.map(importOf)]
    .filter(Boolean)
    .join("\n")}\n`;
}

/** Where the registry serves a sheet: the theme's tokens, a skin, or an element in a style. */
function sheetPath(sheet: string, style: string) {
  if (sheet === "theme") {
    return "/css/theme.css";
  }
  return sheet.startsWith(SKIN)
    ? `/css/skins/${sheet.slice(SKIN.length)}.css`
    : `/css/${style}/${sheet}.css`;
}

/** Writes the sheets given (the theme's tokens, elements, skins) and the index that imports them. */
export async function writeSheets(
  registry: string,
  config: Config,
  sheets: string[],
  folder: string,
  cwd: string,
  overwrite: boolean,
  report: Written
) {
  const contents = await Promise.all(
    sheets.map((sheet) =>
      readRegistryFile(registry, sheetPath(sheet, config.style))
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
