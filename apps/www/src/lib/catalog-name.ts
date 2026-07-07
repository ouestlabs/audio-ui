/** A registry item name belongs to the audio catalog pool (blocks + demos), as opposed to a library item (audio/hooks/lib). */
export function isCatalogItemName(name: string): boolean {
  return name.startsWith("block-") || name.endsWith("-demo");
}
