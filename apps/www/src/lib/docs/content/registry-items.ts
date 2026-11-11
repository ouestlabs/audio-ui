import { hooks } from "@/registry-audio/bases/base/hooks/_registry";
import { lib } from "@/registry-audio/bases/base/lib/_registry";

/** A hook or a lib as the reference pages list it: what it is called, where it is imported from, what it does. */
export interface RegistryItemRow {
  description: string;
  /** Where its first file installs, as a project imports it: `@/hooks/use-polyphony`. */
  from: string;
  name: string;
}

/** A file's extension, and the spaces between names. */
const EXTENSION = /\.tsx?$/;
const SPACES = /\s+/;

const byName = new Map(
  [...hooks, ...lib]
    .filter((item) => (item.files?.length ?? 0) > 0)
    .map((item) => [item.name, item])
);

/** Every hook and lib that installs a file, by name: what the reference pages must list, each once. */
export const REFERENCE_ITEMS: readonly string[] = [...byName.keys()];

/** The rows of `names`, in their order; a name the registry does not have throws, so a page never lists one that is gone. */
export function registryItemRows(names: readonly string[]): RegistryItemRow[] {
  return names.map((name) => {
    const item = byName.get(name);
    const path = item?.files?.[0]?.path;
    if (!(item && path)) {
      throw new Error(`No hook or lib "${name}" in the registry.`);
    }
    const file = path.replace(EXTENSION, "").split("/");
    return {
      description: item.description ?? "",
      from: `@/${file.at(-2)}/${file.at(-1)}`,
      name,
    };
  });
}

const REGISTRY_ITEMS_TAG = /<RegistryItems\s+names="([^"]*)"\s*\/>/g;

/** The names a `<RegistryItems names="…" />` tag lists, separated by spaces. */
export const namesOf = (attribute: string) =>
  attribute.split(SPACES).filter(Boolean);

/** Each `<RegistryItems names="…" />` of a page as the table an agent reads. */
export function expandRegistryItems(content: string) {
  return content.replace(REGISTRY_ITEMS_TAG, (_tag, names: string) =>
    [
      "| Install | Import | What it is |",
      "| --- | --- | --- |",
      ...registryItemRows(namesOf(names)).map(
        (row) =>
          `| \`@audio-ui/${row.name}\` | \`${row.from}\` | ${row.description} |`
      ),
    ].join("\n")
  );
}
