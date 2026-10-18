import { catalog } from "@audio-ui/icons";

const CATALOG_TAG = /<IconCatalog\s*\/>/g;

/** The catalog a reader browses, as the table an agent reads: each icon with its component, its category and what a search finds it by. */
export function iconCatalogTable() {
  return [
    "| Icon | Component | Category | Keywords |",
    "| --- | --- | --- | --- |",
    ...catalog.map(
      (entry) =>
        `| ${entry.name} | \`${entry.name}Icon\` | ${entry.category} | ${entry.keywords.join(", ")} |`
    ),
  ].join("\n");
}

/** Each `<IconCatalog />` of a page as the table of the icons. */
export function expandIconCatalog(content: string) {
  return content.replace(CATALOG_TAG, iconCatalogTable);
}
