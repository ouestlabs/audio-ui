import { FileStack } from "@/components/code/source/file-stack";
import itemFiles from "@/lib/docs/content/item-files.generated.json";

/** A Svelte target names the project's root: `~/src/lib/...` lands in `src/lib/...`. */
const PROJECT_ROOT = /^~\//;

const TARGETS: Record<string, readonly string[] | undefined> = itemFiles;

/**
 * The files of a registry item, to copy and paste where they land: a panel
 * each, stacked, named by where it lands. Where they land comes from the built
 * registry (`registry:build` writes it), so the list is in the page's HTML and
 * says what the CLI would write; each file's code is read when it nears the
 * screen.
 */
export function ItemFiles({
  name,
  from = 0,
  to,
  under = "",
}: {
  name: string;
  /** The first of the item's files to show, by its place in the item. @default 0 */
  from?: number;
  /** The place after the last file to show. @default every file */
  to?: number;
  /** Where a target under the components alias lands in the project: `src/` in a Vite app. */
  under?: string;
}) {
  // A target from the project's root (`~/`) is written as it is; one under the components alias, under `under`.
  const where = (target: string) =>
    PROJECT_ROOT.test(target)
      ? target.replace(PROJECT_ROOT, "")
      : `${under}${target}`;
  const targets = TARGETS[name] ?? [];
  return (
    <FileStack
      name={name}
      paths={targets.slice(from, to).map(where)}
      start={from}
    />
  );
}
