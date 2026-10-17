import { expandDeviceControls } from "@/lib/device-docs";

/** Each docs page's MDX as text, in the bundle: Workers have no files to read, so the build puts them in. */
const rawDocs = import.meta.glob<string>("/src/content/docs/**/*.mdx", {
  import: "default",
  query: "?raw",
});

/** The registry items' JSON for the default style, which holds the source of each component as it installs. */
const registryItems = import.meta.glob<{ files?: { content?: string }[] }>(
  "/public/r/styles/base-nova/*.json",
  { import: "default" }
);

const NAME_ATTR_REGEX = /name="([^"]+)"/;
const TAG_REGEX = /<(ComponentPreview|ComponentSource)\s+([^>]+)\/>/g;

/** A docs page's MDX as written, by its path in the content folder, such as `components/base/(elements)/knob.mdx`. */
export async function readRawDoc(path: string): Promise<string> {
  const load = rawDocs[`/src/content/docs/${path}`];
  return load ? await load() : "";
}

/** The source of a registry item as a reader installs it, or nothing for an item without files. */
async function readItemSource(name: string): Promise<string | undefined> {
  const load = registryItems[`/public/r/styles/base-nova/${name}.json`];
  const item = load ? await load() : undefined;
  return item?.files?.[0]?.content;
}

/**
 * A page as plain markdown for readers that are not browsers: the device
 * controls as tables, and each preview or source tag as the code it shows.
 */
export async function processMdxForLLMs(content: string): Promise<string> {
  if (!content || typeof content !== "string") {
    return content || "";
  }
  const expanded = expandDeviceControls(content);
  const replacements = await Promise.all(
    [...expanded.matchAll(TAG_REGEX)].map(async (match) => {
      const name = match[2]?.match(NAME_ATTR_REGEX)?.[1];
      const source = name ? await readItemSource(name) : undefined;
      return [match[0], source] as const;
    })
  );
  let result = expanded;
  for (const [tag, source] of replacements) {
    if (source) {
      result = result.replace(
        tag,
        `\`\`\`tsx\n${source.replaceAll("export default", "export")}\n\`\`\``
      );
    }
  }
  return result;
}
