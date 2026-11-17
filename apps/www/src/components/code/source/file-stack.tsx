import { useCallback } from "react";
import { DocsComponentSource } from "@/components/code/source/docs-component-source";
import { FilePanel } from "@/components/code/source/file-panel";

const EXTENSION = /\.([a-z]+)$/;

/** One file of the item, read from the registry by its place in the item. */
function StackedFile({
  index,
  name,
  path,
}: {
  index: number;
  name: string;
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
  return <FilePanel name={name} path={path} source={source} />;
}

/**
 * The files of a registry item stacked in one frame, each its own panel that
 * names it, copies it and opens on its code. `paths` are where each file
 * lands, in the item's order.
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
  return (
    <div className="not-typeset mt-6 flex flex-col gap-0.5 overflow-hidden rounded-(--frame-radius) border border-site-border/80 bg-site-muted/50 p-0.5">
      {paths.map((path, index) => (
        <StackedFile index={start + index} key={path} name={name} path={path} />
      ))}
    </div>
  );
}
