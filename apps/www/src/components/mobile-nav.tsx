"use client";

import { BookOpenIcon, CubeIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { ComponentUpdateIndicator } from "@/components/component-update-indicator";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDocsPageUpdateHint } from "@/lib/docs";
import { showMcpDocs } from "@/lib/flags";
import { getCurrentBase, getSectionsFromFolder } from "@/lib/page-tree";
import type { CategoryInfo } from "@/lib/registry";
import type { source } from "@/lib/source";
import { cn, isActive, normalizeSlug } from "@/lib/utils";

type Section = "components" | "docs";

const rowClassName =
  "flex h-9 items-center justify-between gap-3 rounded-md px-2 font-medium text-[0.8rem] text-site-foreground no-underline transition-colors hover:bg-site-muted";

const activeRowClassName = "bg-site-accent";

function NavRow({
  active,
  children,
  href,
  onNavigate,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(rowClassName, active && activeRowClassName)}
      href={href}
      onClick={onNavigate}
      prefetch={false}
    >
      {children}
    </Link>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-site-muted-foreground text-xs tabular-nums">
      {children}
    </span>
  );
}

export function MobileNav({
  items: _items,
  tree,
  componentCategories,
  className,
}: {
  tree: ReturnType<typeof source.getPageTree>;
  items: { href: string; label: string; soon?: boolean }[];
  componentCategories?: CategoryInfo[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const currentBase = getCurrentBase(pathname);
  const [chosen, setChosen] = React.useState<Section | null>(null);
  const section: Section =
    chosen ?? (isActive(pathname, "/components") ? "components" : "docs");
  const close = React.useCallback(() => setOpen(false), []);

  const categoryLinks = React.useMemo(
    () =>
      (componentCategories ?? [])
        .toSorted((a, b) => a.label.localeCompare(b.label))
        .map((category) => ({
          ...category,
          href: `/components/${normalizeSlug(category.name)}`,
        })),
    [componentCategories]
  );
  const totalCount = categoryLinks.reduce((sum, c) => sum + c.count, 0);

  return (
    <Popover modal onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              "extend-touch-target size-8 shrink-0 touch-manipulation items-center justify-center p-0! hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 active:bg-transparent dark:hover:bg-transparent",
              className
            )}
            variant="ghost"
          >
            <div className="relative flex items-center justify-center">
              <div className="relative size-4">
                <span
                  className={cn(
                    "absolute left-0 block h-0.5 w-4 bg-site-foreground transition-[top,transform] duration-150 ease-in-out",
                    open ? "-rotate-45 top-[0.4rem]" : "top-1"
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 block h-0.5 w-4 bg-site-foreground transition-[top,transform] duration-150 ease-in-out",
                    open ? "top-[0.4rem] rotate-45" : "top-2.5"
                  )}
                />
              </div>
              <span className="sr-only">Toggle Menu</span>
            </div>
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="scroll-fade-y no-scrollbar h-(--available-height) w-(--available-width) overflow-y-auto overscroll-contain rounded-(--frame-radius) p-2"
        side="bottom"
        sideOffset={16}
      >
        <div className="flex flex-col gap-2">
          <Tabs
            onValueChange={(value) => setChosen(value as Section)}
            value={section}
          >
            <TabsList
              aria-label="Sections"
              className="w-full bg-site-foreground/8"
            >
              <TabsTrigger value="docs">
                <BookOpenIcon
                  aria-hidden
                  className="size-4"
                  weight={section === "docs" ? "fill" : "regular"}
                />
                Docs
              </TabsTrigger>
              <TabsTrigger value="components">
                <CubeIcon
                  aria-hidden
                  className="size-4"
                  weight={section === "components" ? "fill" : "regular"}
                />
                Components
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <nav aria-label={section} className="flex flex-col gap-0.5">
            <NavRow active={pathname === "/"} href="/" onNavigate={close}>
              Home
            </NavRow>
            {section === "components" ? (
              <>
                <NavRow
                  active={pathname === "/components"}
                  href="/components"
                  onNavigate={close}
                >
                  All components
                  <Count>{totalCount}</Count>
                </NavRow>
                {categoryLinks.map((category) => (
                  <NavRow
                    active={pathname === category.href}
                    href={category.href}
                    key={category.name}
                    onNavigate={close}
                  >
                    {category.label}
                    <span className="flex items-center gap-2">
                      <ComponentUpdateIndicator category={category.name} />
                      <Count>{category.count}</Count>
                    </span>
                  </NavRow>
                ))}
              </>
            ) : (
              tree.children.map((folder) => {
                if (folder.type !== "folder") {
                  return null;
                }
                const sections = getSectionsFromFolder(folder, currentBase)
                  .map((part) => ({
                    ...part,
                    pages: part.pages.filter(
                      (page) => showMcpDocs || !page.url?.includes("/mcp")
                    ),
                  }))
                  .filter((part) => part.pages.length > 0);
                if (sections.length === 0) {
                  return null;
                }
                return (
                  <div className="flex flex-col gap-0.5" key={folder.$id}>
                    <p className="px-2 pt-3 pb-1 font-medium text-site-muted-foreground text-xs">
                      {folder.name}
                    </p>
                    {sections.map((part) => (
                      <React.Fragment key={part.title ?? "untitled"}>
                        {part.title ? (
                          <p className="px-2 pt-1 pb-1 text-site-muted-foreground text-xs">
                            {part.title}
                          </p>
                        ) : null}
                        {part.pages.map((page) => {
                          const hint = getDocsPageUpdateHint(page.url);
                          return (
                            <NavRow
                              active={page.url === pathname}
                              href={page.url}
                              key={page.url}
                              onNavigate={close}
                            >
                              {page.name}
                              {hint ? (
                                <span
                                  aria-hidden="true"
                                  className="site-rounded-full size-1.5 bg-blue-500"
                                  title={hint}
                                />
                              ) : null}
                            </NavRow>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })
            )}
          </nav>
        </div>
      </PopoverContent>
    </Popover>
  );
}
