"use client";

import { ListIcon, PushPinIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const LINE_WIDTH_BY_DEPTH: Record<number, string> = {
  1: "w-4",
  2: "w-3",
  3: "w-2.5",
  4: "w-2",
  5: "w-2",
  6: "w-2",
};

function lineColor(isActive: boolean, isScrolledOver: boolean) {
  if (isActive) {
    return "bg-site-foreground";
  }
  return isScrolledOver ? "bg-site-foreground/60" : "bg-site-foreground/35";
}

const ACTIVE_HEADING_OFFSET = 120;

function useActiveItem(itemIds: string[]) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const elements = itemIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    let ticking = false;

    function update() {
      ticking = false;
      let current: string | null = null;
      for (const element of elements) {
        if (element.getBoundingClientRect().top > ACTIVE_HEADING_OFFSET) {
          break;
        }
        current = element.id;
      }
      setActiveId(current);
    }

    function onScroll() {
      if (ticking) {
        return;
      }
      ticking = true;
      requestAnimationFrame(update);
    }

    function syncFromHash() {
      const hashId = window.location.hash.slice(1);
      if (hashId && elements.some((element) => element.id === hashId)) {
        setActiveId(hashId);
        return true;
      }
      return false;
    }

    if (!syncFromHash()) {
      update();
    }

    const controller = new AbortController();
    const { signal } = controller;
    window.addEventListener("scroll", onScroll, { passive: true, signal });
    window.addEventListener("resize", onScroll, { signal });
    window.addEventListener("hashchange", syncFromHash, { signal });

    return () => controller.abort();
  }, [itemIds]);

  return activeId;
}

export function DocsTableOfContents({
  toc,
  variant = "list",
  className,
}: {
  toc: {
    title?: React.ReactNode;
    url: string;
    depth: number;
  }[];
  variant?: "dropdown" | "list";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const itemIds = React.useMemo(
    () => toc.map((item) => item.url.replace("#", "")),
    [toc]
  );
  const activeHeading = useActiveItem(itemIds);
  const activeIndex = toc.findIndex((item) => item.url === `#${activeHeading}`);
  const activeItemUrl = toc[activeIndex]?.url;
  const itemRefs = React.useRef<Map<string, HTMLLIElement>>(new Map());

  React.useEffect(() => {
    if (!(pinned && activeItemUrl)) {
      return;
    }
    itemRefs.current
      .get(activeItemUrl)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pinned, activeItemUrl]);

  if (!toc?.length) {
    return null;
  }

  if (variant === "dropdown") {
    return (
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <Button className={cn(className)} variant="outline">
              <ListIcon /> On This Page
            </Button>
          }
        />
        <PopoverContent
          align="start"
          className="no-scrollbar scroll-fade max-h-[50svh] min-h-0 w-64 overflow-y-auto"
          side="bottom"
        >
          <div className="flex flex-col gap-0.5">
            {toc.map((item) => (
              <a
                className={cn(
                  "site-rounded-md block truncate px-2 py-1.5 text-sm transition-colors hover:bg-site-muted data-[depth=3]:pl-6 data-[depth=4]:pl-8",
                  item.url === `#${activeHeading}`
                    ? "text-site-primary"
                    : "text-site-foreground/80"
                )}
                data-depth={item.depth}
                href={item.url}
                key={item.url}
                onClick={() => {
                  setOpen(false);
                }}
              >
                {item.title}
              </a>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div
      className={cn(
        "group/toc -translate-y-1/2 fixed top-1/2 right-4 z-40",
        className
      )}
      data-pinned={pinned}
    >
      <div className="flex flex-col items-end gap-3 py-2 transition-opacity duration-100 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/toc:opacity-0 group-hover/toc:duration-150 group-data-[pinned=true]/toc:opacity-0 group-data-[pinned=true]/toc:duration-150">
        {toc.map((item, index) => (
          <span
            className={cn(
              "h-0.5 rounded-full transition-colors",
              LINE_WIDTH_BY_DEPTH[item.depth] ?? "w-2",
              lineColor(
                index === activeIndex,
                activeIndex !== -1 && index < activeIndex
              )
            )}
            key={item.url}
          />
        ))}
      </div>
      <nav className="-translate-y-1/2 site-rounded-2xl pointer-events-none absolute top-1/2 right-0 flex max-h-[60vh] w-60 origin-right scale-95 flex-col border border-site-border bg-site-popover p-2 opacity-0 shadow-lg transition-[opacity,scale] duration-100 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/toc:pointer-events-auto group-hover/toc:scale-100 group-hover/toc:opacity-100 group-hover/toc:duration-150 group-data-[pinned=true]/toc:pointer-events-auto group-data-[pinned=true]/toc:scale-100 group-data-[pinned=true]/toc:opacity-100 group-data-[pinned=true]/toc:duration-150 motion-reduce:scale-100 motion-reduce:transition-opacity">
        <div className="flex items-center justify-between gap-2 pb-1 pl-2">
          <span className="font-medium text-site-muted-foreground text-xs">
            On This Page
          </span>
          <Button
            aria-label={pinned ? "Unpin outline" : "Pin outline"}
            aria-pressed={pinned}
            className={cn(
              "before:-inset-1.5 relative before:absolute before:content-['']",
              pinned ? "text-site-foreground" : "text-site-muted-foreground"
            )}
            onClick={() => setPinned((prev) => !prev)}
            size="icon-sm"
            variant="ghost"
          >
            <span className="relative inline-flex size-4">
              <PushPinIcon
                className={cn(
                  "absolute inset-0 size-4 transition-[opacity,transform,filter] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:transition-opacity",
                  pinned
                    ? "scale-[0.25] opacity-0 blur-xs"
                    : "scale-100 opacity-100 blur-none"
                )}
              />
              <PushPinIcon
                className={cn(
                  "absolute inset-0 size-4 transition-[opacity,transform,filter] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:transition-opacity",
                  pinned
                    ? "scale-100 opacity-100 blur-none"
                    : "scale-[0.25] opacity-0 blur-xs"
                )}
                weight="fill"
              />
            </span>
          </Button>
        </div>
        <ul className="no-scrollbar scroll-fade-y overflow-y-auto">
          {toc.map((item, index) => (
            <li
              key={item.url}
              ref={(el) => {
                if (el) {
                  itemRefs.current.set(item.url, el);
                } else {
                  itemRefs.current.delete(item.url);
                }
              }}
            >
              <Button
                className={cn(
                  "w-full justify-start",
                  index === activeIndex && "underline"
                )}
                nativeButton={false}
                render={
                  <a href={item.url}>
                    <span className="truncate">{item.title}</span>
                  </a>
                }
                size="sm"
                style={{ paddingLeft: `${(item.depth - 1) * 12 + 8}px` }}
                variant={index === activeIndex ? "link" : "ghost"}
              />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
