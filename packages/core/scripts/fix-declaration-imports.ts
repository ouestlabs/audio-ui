/**
 * Gives the relative imports of the emitted `.d.ts` files the extension Node's
 * ESM resolution needs: `"../primitives/knob"` becomes
 * `"../primitives/knob/index.js"`. Without it a project using
 * `moduleResolution: "node16"` or `"nodenext"` cannot resolve the package's types.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

// The package to fix is the one the script is run from: `bun ../core/scripts/fix-declaration-imports.ts` in `packages/ui` fixes its `dist`.
const DIST = resolve(process.cwd(), "dist");
const HAS_EXTENSION = /\.(js|json|css)$/;
const TRAILING_SLASH = /\/$/;
const RELATIVE =
  /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']*)\2/g;

function declarationFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return declarationFiles(path);
    }
    return name.endsWith(".d.ts") ? [path] : [];
  });
}

function withExtension(from: string, specifier: string): string {
  if (HAS_EXTENSION.test(specifier)) {
    return specifier;
  }
  const target = resolve(dirname(from), specifier);
  if (existsSync(`${target}.d.ts`)) {
    return `${specifier}.js`;
  }
  if (existsSync(join(target, "index.d.ts"))) {
    return `${specifier.replace(TRAILING_SLASH, "")}/index.js`;
  }
  return specifier;
}

let changed = 0;
for (const file of declarationFiles(DIST)) {
  const source = readFileSync(file, "utf8");
  const next = source.replace(
    RELATIVE,
    (_match, lead: string, quote: string, specifier: string) =>
      `${lead}${quote}${withExtension(file, specifier)}${quote}`
  );
  if (next !== source) {
    writeFileSync(file, next);
    changed += 1;
  }
}
console.log(`declaration imports: ${changed} files given their extensions`);
