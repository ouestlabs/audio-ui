import {
  type IconLibraryName,
  iconLibraries,
  PRESETS,
} from "@/registry/config";

const KNOWN_ICON_LIBRARIES = new Set([
  "lucide",
  "tabler",
  "hugeicons",
  "phosphor",
  "remixicon",
]);

const SELF_CLOSING_TAG_REGEX = /\/>/;
const TAG_CLOSE_REGEX = />/;
const NAMED_IMPORT_BRACES_REGEX = /{([^}]+)}/;
const IMPORT_END_REGEX =
  /from\s+["'][^"']+["'];?\n?|import\s+["'][^"']+["'];?\n?/;

export function getIconLibraryFromStyle(styleName: string): IconLibraryName {
  const preset = PRESETS.find(
    (p) => p.name === styleName || p.style === styleName
  );
  if (preset) {
    return preset.iconLibrary;
  }

  if (styleName.includes("vega")) {
    return "lucide";
  }
  if (
    styleName.includes("nova") ||
    styleName.includes("maia") ||
    styleName.includes("mira")
  ) {
    return "hugeicons";
  }
  if (styleName.includes("lyra")) {
    return "hugeicons";
  }
  return "lucide";
}

type ParsedIconAttributes = {
  iconName: string;
  replacedIcons: string[];
  attributes: Record<string, string>;
};

// Parse the attributes of a single <IconPlaceholder .../> tag.
function parseIconAttributes(
  attrs: string,
  libraryName: IconLibraryName
): ParsedIconAttributes {
  const attributes: Record<string, string> = {};
  const replacedIcons: string[] = [];
  let iconName = "";

  const attrRegex = /([a-zA-Z0-9-]+)="([^"]+)"|([a-zA-Z0-9-]+)={([^}]+)}/gi;
  let attrMatch = attrRegex.exec(attrs);
  while (attrMatch !== null) {
    const name = attrMatch[1] || attrMatch[3];
    const value = attrMatch[2] || attrMatch[4];

    if (name === libraryName) {
      iconName = value;
    } else if (KNOWN_ICON_LIBRARIES.has(name)) {
      replacedIcons.push(value);
    } else {
      attributes[name] = value;
    }

    attrMatch = attrRegex.exec(attrs);
  }

  return { attributes, iconName, replacedIcons };
}

// Build the icon usage snippet from the library template and extra attributes.
function buildIconUsage(
  usageTemplate: string,
  iconName: string,
  attributes: Record<string, string>
): string {
  let usage = usageTemplate.replace(/ICON/g, iconName);

  const otherAttrs = Object.entries(attributes)
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");

  if (otherAttrs) {
    if (usage.includes("/>")) {
      usage = usage.replace(SELF_CLOSING_TAG_REGEX, ` ${otherAttrs} />`);
    } else if (usage.includes(">")) {
      usage = usage.replace(TAG_CLOSE_REGEX, ` ${otherAttrs}>`);
    }
  }

  return usage;
}

// Remove imports of replaced icons that are no longer referenced in the code.
function removeUnusedIconImports(
  code: string,
  replacedIcons: Set<string>
): string {
  let result = code;

  for (const icon of replacedIcons) {
    // Check if the icon is still used in the code (not as part of an import).
    const isUsed = new RegExp(
      `(?<!import\\s+\\{.*)\\b${icon}\\b(?!.*from\\s+['"])`,
      "s"
    ).test(result);

    if (isUsed) {
      continue;
    }

    // Remove from named imports: { ..., Icon, ... } -> { ..., ... }
    const importRegex = new RegExp(
      `import\\s+{[^}]*\\b${icon}\\b[^}]*}\\s+from\\s+['"][^'"]+['"];?\\n?`,
      "g"
    );
    result = result.replace(importRegex, (match) => {
      const namedMatch = match.match(NAMED_IMPORT_BRACES_REGEX);
      if (!namedMatch) {
        return match;
      }

      const names = namedMatch[1]
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n !== icon && n !== "");
      if (names.length === 0) {
        return ""; // Remove whole line
      }
      return match.replace(namedMatch[1], ` ${names.join(", ")} `);
    });
  }

  return result;
}

// Insert the generated icon import after the last import, "use client", or top.
function insertIconImport(code: string, importStatement: string): string {
  const lastImportIndex = code.lastIndexOf("import ");
  const useClientIndex = code.indexOf('"use client"');
  const useClientSingleIndex = code.indexOf("'use client'");

  if (lastImportIndex !== -1) {
    // Find the end of the import statement (it might be multi-line).
    const searchSpace = code.slice(lastImportIndex);
    const importEndMatch = searchSpace.match(IMPORT_END_REGEX);

    const endOfLastImport = importEndMatch
      ? lastImportIndex + (importEndMatch.index ?? 0) + importEndMatch[0].length
      : code.indexOf("\n", lastImportIndex) + 1;

    return (
      code.slice(0, endOfLastImport) +
      importStatement +
      code.slice(endOfLastImport)
    );
  }

  if (useClientIndex !== -1 || useClientSingleIndex !== -1) {
    const index = useClientIndex === -1 ? useClientSingleIndex : useClientIndex;
    const endOfUseClient = code.indexOf("\n", index) + 1;
    return (
      code.slice(0, endOfUseClient) +
      "\n" +
      importStatement +
      code.slice(endOfUseClient)
    );
  }

  return importStatement + code;
}

export function transformIcons(
  code: string,
  libraryName: IconLibraryName
): string {
  const library = iconLibraries[libraryName];
  if (!library) {
    return code;
  }

  const iconPlaceholderRegex = /<IconPlaceholder\s+([^>]+)\/>/g;
  const usedIcons = new Set<string>();
  const replacedIcons = new Set<string>();
  const iconPlaceholderImportRegex =
    /import\s+{\s*IconPlaceholder\s*}\s*from\s*["']@\/app\/\(create\)\/components\/icon-placeholder["'];?\n?/g;

  let transformedCode = code.replace(iconPlaceholderRegex, (match, attrs) => {
    const {
      iconName,
      replacedIcons: currentReplacedIcons,
      attributes,
    } = parseIconAttributes(attrs, libraryName);

    if (!iconName) {
      return match;
    }

    usedIcons.add(iconName);
    for (const icon of currentReplacedIcons) {
      replacedIcons.add(icon);
    }

    return buildIconUsage(library.usage, iconName, attributes);
  });

  // Remove IconPlaceholder import
  transformedCode = transformedCode.replace(iconPlaceholderImportRegex, "");

  // Remove imports of replaced icons if they are no longer used
  if (replacedIcons.size > 0) {
    transformedCode = removeUnusedIconImports(transformedCode, replacedIcons);
  }

  if (usedIcons.size > 0) {
    const iconsArray = Array.from(usedIcons).sort();
    const iconsList = iconsArray.join(", ");

    // Use the import template from libraries.ts
    const importStatement = `${library.import.replace(/ICON/g, iconsList)}\n`;
    transformedCode = insertIconImport(transformedCode, importStatement);
  }

  // Final cleanup: remove triple newlines and trim
  return `${transformedCode.replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
