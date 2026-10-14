/**
 * Scans the audio registry for the icons it uses and writes two reports in
 * `src/registry/icons` that `build-icons.ts` reads:
 *
 * - `scanned-icons.json`: every `<IconPlaceholder>` and the icon it names for
 *   each library (mapped icons)
 * - `unmapped-icons.json`: every icon imported straight from `lucide-react`
 *   (unmapped icons, Lucide only)
 *
 * Run: bun run icons:scan
 */
import {
  type ImportDeclaration,
  type JsxAttribute,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Project,
  type SourceFile,
  SyntaxKind,
  ts,
} from "ts-morph";

const PROJECT_ROOT = Bun.fileURLToPath(new URL("..", import.meta.url)).slice(
  0,
  -1
);

// Only scan base folder. Catalog blocks: bases/base/components (c-*).
const TARGET_DIR = "src/registry-audio/bases/base";
const OUTPUT_FILE = "src/registry/icons/scanned-icons.json";
const UNMAPPED_OUTPUT_FILE = "src/registry/icons/unmapped-icons.json";

// Imported from lucide-react but not an icon.
const LUCIDE_TYPES = new Set(["LucideProps", "LucideIcon"]);
// Icons are components: capitalized.
const COMPONENT_NAME = /^[A-Z]/;
// Where an imported name is a declaration or a type, not a use.
const NOT_A_USE = new Set([
  SyntaxKind.ImportSpecifier,
  SyntaxKind.TypeReference,
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeAliasDeclaration,
]);

/** An `<IconPlaceholder>` with its string props: `lucide`, `tabler`... */
interface PlaceholderUsage {
  _path: string;
  [prop: string]: string;
}

interface UnmappedUsage {
  _path: string;
  icon: string;
  localName?: string;
}

/** The text of a string prop: `lucide="Check"` or `lucide={"Check"}`. */
function stringValue(attribute: JsxAttribute): string | undefined {
  const initializer = attribute.getInitializer();
  if (initializer?.getKind() === SyntaxKind.StringLiteral) {
    return initializer
      .asKindOrThrow(SyntaxKind.StringLiteral)
      .getLiteralValue()
      .trim();
  }
  if (initializer?.getKind() === SyntaxKind.JsxExpression) {
    const expression = initializer
      .asKindOrThrow(SyntaxKind.JsxExpression)
      .getExpression();
    if (expression?.getKind() === SyntaxKind.StringLiteral) {
      return expression
        .asKindOrThrow(SyntaxKind.StringLiteral)
        .getLiteralValue()
        .trim();
    }
  }
  return undefined;
}

/** Every `<IconPlaceholder>` (mapped). */
function placeholderUsages(
  sourceFile: SourceFile,
  path: string
): PlaceholderUsage[] {
  const isPlaceholder = (element: JsxOpeningElement | JsxSelfClosingElement) =>
    element.getTagNameNode().getText() === "IconPlaceholder";

  // Opening elements too, in case it is not self-closing (though it should be).
  const elements = [
    ...sourceFile
      .getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
      .filter(isPlaceholder),
    ...sourceFile
      .getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
      .filter(isPlaceholder),
  ];

  return elements.map((element) => {
    const usage: PlaceholderUsage = { _path: path };
    for (const attribute of element.getAttributes()) {
      if (attribute.getKind() === SyntaxKind.JsxAttribute) {
        const jsxAttribute = attribute.asKindOrThrow(SyntaxKind.JsxAttribute);
        const value = stringValue(jsxAttribute);
        if (value !== undefined) {
          usage[jsxAttribute.getNameNode().getText()] = value;
        }
      }
    }
    return usage;
  });
}

/** `import { Check, X as Close } from "lucide-react"`: local name to icon. */
function importedIcons(declarations: ImportDeclaration[]) {
  const icons = new Map<string, string>();
  for (const declaration of declarations) {
    for (const named of declaration.getNamedImports()) {
      const originalName = named.getName();
      if (!LUCIDE_TYPES.has(originalName)) {
        icons.set(
          named.getAliasNode()?.getText() || originalName,
          originalName
        );
      }
    }
  }
  return icons;
}

/** `import * as Lucide from "lucide-react"`, then `<Lucide.Check />`. */
function namespaceUsages(
  sourceFile: SourceFile,
  declarations: ImportDeclaration[],
  path: string
): UnmappedUsage[] {
  const found: UnmappedUsage[] = [];
  for (const declaration of declarations) {
    const starName = declaration.getNamespaceImport()?.getText();
    if (!starName) {
      continue;
    }
    for (const access of sourceFile.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression
    )) {
      const icon = access.getName().trim();
      if (
        access.getExpression().getText() === starName &&
        icon &&
        COMPONENT_NAME.test(icon)
      ) {
        found.push({ _path: path, icon });
      }
    }
  }
  return found;
}

/** The uses of the names `import { ... }` brought in. */
function namedUsages(
  sourceFile: SourceFile,
  icons: Map<string, string>,
  path: string
): UnmappedUsage[] {
  if (icons.size === 0) {
    return [];
  }
  const found: UnmappedUsage[] = [];
  for (const identifier of sourceFile.getDescendantsOfKind(
    SyntaxKind.Identifier
  )) {
    const localName = identifier.getText().trim();
    const icon = icons.get(localName)?.trim();
    const parent = identifier.getParent();
    if (
      icon &&
      parent &&
      !NOT_A_USE.has(parent.getKind()) &&
      COMPONENT_NAME.test(icon)
    ) {
      found.push({
        _path: path,
        icon,
        localName: localName === icon ? undefined : localName,
      });
    }
  }
  return found;
}

/** Every icon used straight from `lucide-react` (unmapped). */
function lucideUsages(sourceFile: SourceFile, path: string): UnmappedUsage[] {
  const declarations = sourceFile
    .getImportDeclarations()
    .filter(
      (declaration) => declaration.getModuleSpecifierValue() === "lucide-react"
    );
  return [
    ...namespaceUsages(sourceFile, declarations, path),
    ...namedUsages(sourceFile, importedIcons(declarations), path),
  ];
}

async function scanIcons() {
  console.log("Scanning for IconPlaceholder and Lucide icons in", TARGET_DIR);

  // Sorted, so the reports come out the same on every run.
  const files = (
    await Array.fromAsync(
      new Bun.Glob("**/*.tsx").scan({ cwd: `${PROJECT_ROOT}/${TARGET_DIR}` })
    )
  )
    .sort()
    .map((file) => `${TARGET_DIR}/${file}`);

  const sources = await Promise.all(
    files.map(async (path) => ({
      content: await Bun.file(`${PROJECT_ROOT}/${path}`).text(),
      path,
    }))
  );

  const project = new Project({
    compilerOptions: { jsx: ts.JsxEmit.Preserve },
  });

  const matches: PlaceholderUsage[] = [];
  const unmappedMatches: UnmappedUsage[] = [];

  for (const { content, path } of sources) {
    // We only process files that actually mention "IconPlaceholder" or "lucide-react" to save time
    const hasPlaceholder = content.includes("IconPlaceholder");
    const hasLucide = content.includes("lucide-react");
    if (!(hasPlaceholder || hasLucide)) {
      continue;
    }

    const sourceFile = project.createSourceFile("temp.tsx", content, {
      overwrite: true,
    });

    if (hasPlaceholder) {
      matches.push(...placeholderUsages(sourceFile, path));
    }
    if (hasLucide) {
      unmappedMatches.push(...lucideUsages(sourceFile, path));
    }

    // Cleanup to prevent memory leaks
    project.removeSourceFile(sourceFile);
  }

  // Save results
  await Promise.all([
    Bun.write(
      `${PROJECT_ROOT}/${OUTPUT_FILE}`,
      JSON.stringify(matches, null, 2)
    ),
    Bun.write(
      `${PROJECT_ROOT}/${UNMAPPED_OUTPUT_FILE}`,
      JSON.stringify(unmappedMatches, null, 2)
    ),
  ]);

  console.log("\nScan Summary:");
  console.log(`- Mapped (IconPlaceholder): ${matches.length}`);
  console.log(`- Unmapped (lucide-react): ${unmappedMatches.length}`);

  console.log(
    `\nFull reports saved to ${OUTPUT_FILE} and ${UNMAPPED_OUTPUT_FILE}`
  );
}

await scanIcons();
