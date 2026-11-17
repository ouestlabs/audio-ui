import { DownloadSimpleIcon } from "@phosphor-icons/react/ssr";
import { useCallback, useState } from "react";
import { DocsComponentSource } from "@/components/code/source/docs-component-source";
import { FilePanel } from "@/components/code/source/file-panel";
import { Button } from "@/components/ui/button";

const EXTENSION = /\.([a-z]+)$/;

/** One file of the item, read from the registry by its place in the item. */
function StackedFile({
  index,
  name,
  onLoad,
  path,
}: {
  index: number;
  name: string;
  onLoad: (path: string, code: string) => void;
  path: string;
}) {
  const source = useCallback(
    (onCode: (code: string) => void) => (
      <DocsComponentSource
        collapsible={false}
        file={index}
        language={EXTENSION.exec(path)?.[1]}
        name={name}
        onCode={onCode}
        showCopyButton={false}
        styleName="base-nova"
      />
    ),
    [index, name, path]
  );
  const report = useCallback(
    (code: string) => onLoad(path, code),
    [onLoad, path]
  );
  return <FilePanel name={name} onCode={report} path={path} source={source} />;
}

/** Saves `files` as one zip, each at its path. */
async function downloadZip(name: string, files: Record<string, string>) {
  const { strToU8, zipSync } = await import("fflate");
  const zipped = zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, code]) => [path, strToU8(code)])
    )
  );
  const url = URL.createObjectURL(
    new Blob([zipped as BlobPart], { type: "application/zip" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The files of a registry item stacked in one frame, each its own panel that
 * names it, copies it and opens on its code. Several files come with a bar
 * that saves them all as a zip, each at its path, the code the panels show.
 * `paths` are where each file lands, in the item's order.
 */
export function FileStack({
  name,
  paths,
  start = 0,
}: {
  name: string;
  paths: readonly string[];
  /** The place in the item of the first path, when the stack shows only some of its files. @default 0 */
  start?: number;
}) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const onLoad = useCallback(
    (path: string, code: string) =>
      setCodes((current) =>
        current[path] === code ? current : { ...current, [path]: code }
      ),
    []
  );
  const ready = paths.every((path) => codes[path] !== undefined);
  const download = useCallback(
    () =>
      downloadZip(
        name,
        Object.fromEntries(paths.map((path) => [path, codes[path] ?? ""]))
      ),
    [codes, name, paths]
  );
  return (
    <div className="not-typeset mt-6 flex flex-col gap-0.5 overflow-hidden rounded-(--frame-radius) border border-site-border/80 bg-site-muted/50 p-0.5">
      {paths.length > 1 ? (
        <div className="flex h-10 items-center justify-between pr-1.5 pl-3">
          <span className="font-site-mono text-site-muted-foreground text-xs">
            {paths.length} files
          </span>
          <Button
            disabled={!ready}
            onClick={download}
            size="sm"
            type="button"
            variant="ghost"
          >
            <DownloadSimpleIcon aria-hidden="true" />
            Download .zip
          </Button>
        </div>
      ) : null}
      {paths.map((path, index) => (
        <StackedFile
          index={start + index}
          key={path}
          name={name}
          onLoad={onLoad}
          path={path}
        />
      ))}
    </div>
  );
}
