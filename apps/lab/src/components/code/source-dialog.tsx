import { CheckIcon, CopyIcon, XIcon } from "@phosphor-icons/react/ssr";
import { useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileTree } from "@/components/code/file-tree";
import { HighlightedCode } from "@/components/code/highlighted-code";
import { FrameContent, FrameHeader } from "@/components/site/layout/frame";
import { useLab } from "@/components/site/providers/lab-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileType, getFileType } from "@/components/ui/file-type";
import { DEVICES, sourceFiles } from "@/lib/devices";

/** A tab of the row on small screens, as an editor has them: the file's icon and name, the one on show joined to the code below it. */
function FileTab({
  active,
  name,
  onPick,
}: {
  active: boolean;
  name: string;
  onPick: (name: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const pick = useCallback(() => onPick(name), [name, onPick]);
  const parts = name.split("/");
  const base = parts.pop() ?? name;

  // The row follows the tab on show, so it is never out of sight.
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [active]);

  return (
    <button
      aria-selected={active}
      className={cn(
        "-mb-px flex h-9 shrink-0 items-center gap-1.5 border-r border-t-2 last:border-r-0 border-t-transparent px-3 text-xs transition-colors",
        active
          ? "border-t-primary bg-background text-foreground"
          : "bg-muted/40 text-muted-foreground"
      )}
      onClick={pick}
      ref={ref}
      role="tab"
      title={name}
      type="button"
    >
      <FileType
        aria-hidden
        size="xs"
        type={getFileType(base)}
        variant="outline"
      />
      <span>
        {parts.length > 0 ? (
          <span className="text-muted-foreground/70">{parts.join("/")}/</span>
        ) : null}
        {base}
      </span>
    </button>
  );
}

/** The code of the device on screen, in the lab itself: its files on the left, one of them highlighted on the right. */
export function SourceDialog() {
  const { actions, state } = useLab();
  const { device: slug } = useParams({ strict: false });
  const device = DEVICES.find((item) => item.slug === slug);
  const files = device ? sourceFiles(device.slug) : [];
  const [name, setName] = useState("index.tsx");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const file = files.find((item) => item.name === name) ?? files[0];

  useEffect(() => {
    if (!(state.sourceOpen && file)) {
      return;
    }
    let current = true;
    file.load().then((text) => {
      if (current) {
        setCode(text);
      }
    });
    return () => {
      current = false;
    };
  }, [file, state.sourceOpen]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }, [code]);

  if (!device) {
    return null;
  }

  return (
    <Dialog onOpenChange={actions.setSourceOpen} open={state.sourceOpen}>
      <DialogContent
        className="top-2 left-2 flex h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-xl border bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))] p-0.5 shadow-2xl ring-0 sm:max-w-none min-[66rem]:top-1/2 min-[66rem]:left-1/2 min-[66rem]:h-[min(44rem,calc(100dvh-2rem))] min-[66rem]:w-full min-[66rem]:max-w-5xl min-[66rem]:-translate-x-1/2 min-[66rem]:-translate-y-1/2"
        showCloseButton={false}
      >
        <FrameHeader className="shrink-0 gap-2">
          <DialogHeader className="min-w-0 flex-1">
            <DialogTitle className="truncate font-medium text-sm">
              <span className="max-sm:hidden">{device.title} · </span>
              {file?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              The code of {device.title}, file by file.
            </DialogDescription>
          </DialogHeader>
          <DialogClose
            render={
              <Button aria-label="Close" size="icon-sm" variant="outline">
                <XIcon aria-hidden />
              </Button>
            }
          />
        </FrameHeader>
        <div className="flex min-h-0 flex-1 gap-0.5">
          <FrameContent className="slim-scroll hidden w-60 shrink-0 overflow-y-auto p-2 sm:block">
            <FileTree
              files={files}
              onSelect={setName}
              selected={file?.name ?? ""}
            />
          </FrameContent>
          <FrameContent className="flex min-w-0 flex-1 flex-col">
            {/* Small screens have no room for the tree: the files are tabs, as in an editor. */}
            <div
              aria-label="Files"
              className="no-scrollbar scroll-fade-x flex shrink-0 overflow-x-auto border-b bg-muted/40 sm:hidden"
              role="tablist"
            >
              {files.map((item) => (
                <FileTab
                  active={item.name === file?.name}
                  key={item.name}
                  name={item.name}
                  onPick={setName}
                />
              ))}
            </div>
            <div className="relative min-h-0 flex-1" role="tabpanel">
              <div className="slim-scroll h-full overflow-auto overscroll-contain">
                <HighlightedCode code={code} language={file?.language} />
              </div>
              <Button
                aria-label={copied ? "Copied" : "Copy the code"}
                className="absolute top-2 right-2"
                onClick={copy}
                size="icon-sm"
                variant="outline"
              >
                {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
              </Button>
            </div>
          </FrameContent>
        </div>
      </DialogContent>
    </Dialog>
  );
}
