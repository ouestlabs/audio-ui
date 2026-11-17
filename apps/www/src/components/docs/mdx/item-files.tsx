import { useEffect, useState } from "react";
import { FileStack } from "@/components/code/source/file-stack";
import { getRegistryJsonUrl } from "@/lib/registry/core/registry";

/** A Svelte target names the project's root: `~/src/lib/...` lands in `src/lib/...`. */
const PROJECT_ROOT = /^~\//;

interface BuiltFile {
  path: string;
  target?: string;
}

/**
 * The files of a registry item, to copy and paste where they land: a panel
 * each, stacked, named by where it lands. Read from the item itself, so it
 * shows what the CLI would write.
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
  const [files, setFiles] = useState<BuiltFile[]>([]);
  useEffect(() => {
    let live = true;
    fetch(getRegistryJsonUrl("base-nova", name))
      .then((response) => response.json() as Promise<{ files?: BuiltFile[] }>)
      .then((item) => {
        if (live) {
          setFiles(item.files ?? []);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [name]);
  // A target from the project's root (`~/`) is written as it is; one under the components alias, under `under`.
  const where = (file: BuiltFile) => {
    const target = file.target ?? file.path;
    return PROJECT_ROOT.test(target)
      ? target.replace(PROJECT_ROOT, "")
      : `${under}${target}`;
  };
  if (files.length === 0) {
    return <div aria-hidden="true" className="min-h-24" />;
  }
  return (
    <FileStack
      name={name}
      paths={files.slice(from, to).map(where)}
      start={from}
    />
  );
}
