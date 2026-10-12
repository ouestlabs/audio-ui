import { getRegistryItemMetadata } from "@/lib/registry";

/** What to say about a preview that its demo does not: how to use it, shown in the footer of its frame. */
export function getPreviewHint(
  name: string,
  base = "base"
): string | undefined {
  const hint = getRegistryItemMetadata(name, base)?.meta?.hint;
  return typeof hint === "string" ? hint : undefined;
}
