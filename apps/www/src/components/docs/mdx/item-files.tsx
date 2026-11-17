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
 * The files of a registry item, to copy and paste where they land: a tab
 * each, named by its file, its code with a copy button under its path. Read
 * from the item itself, so it shows what the CLI would write.
 */
export function ItemFiles({
  name,
  under = "",
}: {
  name: string;
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
  return <FileStack name={name} paths={files.map(where)} />;
}
