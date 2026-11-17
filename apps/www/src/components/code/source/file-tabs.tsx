import { useCallback, useState } from "react";
import { DocsComponentSource } from "@/components/code/source/docs-component-source";
import { getIconForLanguageExtension } from "@/components/site/icons";
import { cn } from "@/lib/utils";

const EXTENSION = /\.([a-z]+)$/;

/** One file's tab, as an editor draws it: its language's logo, its folder dimmed, the one open on the code's background. */
function FileTab({
  active,
  onPick,
  path,
}: {
  active: boolean;
  onPick: (path: string) => void;
  path: string;
}) {
  const pick = useCallback(() => onPick(path), [onPick, path]);
  const parts = path.split("/");
  const base = parts.pop() ?? path;
  const folder = parts.at(-1);
  return (
    <button
      aria-selected={active}
      className={cn(
        "-mb-px flex h-9 shrink-0 items-center gap-1.5 border-site-border border-r px-3 text-xs transition-colors last:border-r-0",
        active
          ? "bg-site-code text-site-foreground"
          : "text-site-muted-foreground hover:text-site-foreground"
      )}
      onClick={pick}
      role="tab"
      title={path}
      type="button"
    >
      {getIconForLanguageExtension(EXTENSION.exec(base)?.[1] ?? "", {
        className: "size-3.5 shrink-0",
      })}
      <span>
        {folder ? (
          <span className="text-site-muted-foreground/70">{folder}/</span>
        ) : null}
        {base}
      </span>
    </button>
  );
}

/**
 * The files of a registry item in one frame, as an editor shows them: their
 * tabs on top (a file's folder and name, its whole path on hover), the open
 * one's code under them with a copy button. `paths` are where each file lands, in the item's order.
 */
export function FileTabs({
  name,
  paths,
}: {
  name: string;
  paths: readonly string[];
}) {
  const [open, setOpen] = useState(0);
  const pick = useCallback(
    (path: string) => setOpen(Math.max(paths.indexOf(path), 0)),
    [paths]
  );
  return (
    <div className="not-typeset mt-6 overflow-hidden rounded-(--frame-radius) border border-site-border/80 bg-site-muted/50 p-0.5">
      <div
        aria-label="Files"
        className="no-scrollbar scroll-fade-x flex overflow-x-auto"
        role="tablist"
      >
        {paths.map((path, index) => (
          <FileTab
            active={index === open}
            key={path}
            onPick={pick}
            path={path}
          />
        ))}
      </div>
      <div
        className="overflow-hidden rounded-[max(calc(var(--frame-radius)-3px),0px)] border border-site-border bg-site-code"
        data-slot="code"
        role="tabpanel"
      >
        <DocsComponentSource
          file={open}
          key={paths[open]}
          language={EXTENSION.exec(paths[open] ?? "")?.[1]}
          name={name}
          styleName="base-nova"
        />
      </div>
    </div>
  );
}
