import { useCallback, useState } from "react";
import { CopyButton } from "@/components/code/copy/copy-button";
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
        // Its corners follow the frame's, less the frame's border, its padding and the list's.
        "flex h-8 shrink-0 items-center gap-1.5 rounded-[max(calc(var(--frame-radius)-7px),0px)] border px-2.5 text-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active
          ? "border-site-border bg-site-code text-site-foreground"
          : "border-transparent text-site-muted-foreground hover:text-site-foreground"
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
  // The open file's code, as it shows: the header's copy button copies it.
  const [code, setCode] = useState<string>();
  const pick = useCallback(
    (path: string) => {
      setOpen(Math.max(paths.indexOf(path), 0));
      setCode(undefined);
    },
    [paths]
  );
  return (
    <div className="not-typeset mt-6 overflow-hidden rounded-(--frame-radius) border border-site-border/80 bg-site-muted/50 p-0.5">
      {/* The tabs scroll when they outgrow the frame; the copy button stays at its end. */}
      <div className="flex items-center">
        <div
          aria-label="Files"
          // Its padding is the room a tab's focus ring needs inside the scroller.
          className="no-scrollbar scroll-fade-x flex min-w-0 flex-1 gap-1 overflow-x-auto p-1"
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
        {code ? (
          <CopyButton
            className="static mr-1 shrink-0 bg-transparent"
            event="copy_component_code"
            properties={{ name, path: paths[open] }}
            value={code}
          />
        ) : null}
      </div>
      <div
        className="overflow-hidden rounded-[max(calc(var(--frame-radius)-3px),0px)] border border-site-border bg-site-code [&_pre]:max-h-96 [&_pre]:overflow-auto [&_pre]:scroll-fade-y"
        data-slot="code"
        role="tabpanel"
      >
        {/* The code scrolls in a fixed height: no Expand to press. */}
        <DocsComponentSource
          collapsible={false}
          file={open}
          key={paths[open]}
          language={EXTENSION.exec(paths[open] ?? "")?.[1]}
          name={name}
          onCode={setCode}
          showCopyButton={false}
          styleName="base-nova"
        />
      </div>
    </div>
  );
}
