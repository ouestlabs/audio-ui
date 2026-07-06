"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { ComponentUpdateIndicator } from "@/components/component-update-indicator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getDocsPageUpdateHint } from "@/lib/docs";
import { showMcpDocs } from "@/lib/flags";
import {
  getAllPagesFromFolder,
  getCurrentBase,
  getPagesFromFolder,
} from "@/lib/page-tree";
import type { CategoryInfo } from "@/lib/registry";
import type { source } from "@/lib/source";
import { cn, isActive, normalizeSlug } from "@/lib/utils";

export function MobileNav({
  items,
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
  const mobileComponentCategories = React.useMemo(
    () => componentCategories ?? [],
    [componentCategories]
  );
  const componentCategoryLinks = React.useMemo(
    () =>
      [...mobileComponentCategories]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((category) => ({
          ...category,
          href: `/components/${normalizeSlug(category.name)}`,
        })),
    [mobileComponentCategories]
  );
  const totalComponentCount = React.useMemo(
    () =>
      mobileComponentCategories.reduce(
        (total, category) => total + category.count,
        0
      ),
    [mobileComponentCategories]
  );

  const activeFolders = React.useMemo(() => {
    const folders: string[] = [];
    for (const item of tree.children) {
      if (item.type === "folder") {
        const hasActiveChild = getAllPagesFromFolder(item).some(
          (page) => page.url === pathname
        );
        if (hasActiveChild && item.$id) {
          folders.push(item.$id);
        }
      }
    }
    return folders;
  }, [tree.children, pathname]);

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
                    "absolute left-0 block h-0.5 w-4 bg-site-foreground transition-all duration-100",
                    open ? "-rotate-45 top-[0.4rem]" : "top-1"
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 block h-0.5 w-4 bg-site-foreground transition-all duration-100",
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
        className="scroll-fade-y no-scrollbar h-(--available-height) w-(--available-width) overflow-y-auto overscroll-contain"
        side="bottom"
        sideOffset={16}
      >
        <div className="flex flex-col gap-8 px-6 py-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <MobileLink
                active={pathname === "/"}
                href="/"
                onOpenChange={setOpen}
              >
                Home
              </MobileLink>
              {items.map((item) => (
                <div className="flex flex-col gap-3" key={item.href}>
                  <MobileNavEntry
                    activeFolders={activeFolders}
                    componentCategoryLinks={componentCategoryLinks}
                    currentBase={currentBase}
                    item={item}
                    onOpenChange={setOpen}
                    pathname={pathname}
                    totalComponentCount={totalComponentCount}
                    tree={tree}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type MobileNavItem = { href: string; label: string; soon?: boolean };
type MobileNavTree = ReturnType<typeof source.getPageTree>;
type MobileNavCategoryLink = CategoryInfo & { href: string };

function MobileComponentsNav({
  item,
  pathname,
  totalComponentCount,
  componentCategoryLinks,
  onOpenChange,
}: {
  item: MobileNavItem;
  pathname: string;
  totalComponentCount: number;
  componentCategoryLinks: MobileNavCategoryLink[];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Accordion
      className="w-full"
      defaultValue={
        isActive(pathname, "/components") ? ["components"] : undefined
      }
    >
      <AccordionItem className="border-none" value="components">
        <AccordionTrigger className="py-0 font-medium text-site-foreground/70 text-sm hover:no-underline data-[state=open]:text-site-primary">
          {item.label}
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-0">
          <div className="flex flex-col gap-3 pl-4">
            <MobileLink
              active={pathname === item.href}
              className="flex items-center justify-between gap-3 font-normal text-sm"
              href={item.href}
              onOpenChange={onOpenChange}
            >
              <span>All Components</span>
              <span className="text-site-muted-foreground text-xs">
                {totalComponentCount}
              </span>
            </MobileLink>
            {componentCategoryLinks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {componentCategoryLinks.map((category) => (
                  <MobileLink
                    active={pathname === category.href}
                    className="flex items-center justify-between gap-3 font-normal text-sm"
                    href={category.href}
                    key={category.name}
                    onOpenChange={onOpenChange}
                  >
                    <span>{category.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <ComponentUpdateIndicator category={category.name} />
                      <span className="text-site-muted-foreground text-xs">
                        {category.count}
                      </span>
                    </span>
                  </MobileLink>
                ))}
              </div>
            ) : null}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function MobileDocsNav({
  item,
  pathname,
  tree,
  currentBase,
  activeFolders,
  onOpenChange,
}: {
  item: MobileNavItem;
  pathname: string;
  tree: MobileNavTree;
  currentBase: string;
  activeFolders: string[];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Accordion
      className="w-full"
      defaultValue={isActive(pathname, "/docs") ? ["docs"] : undefined}
    >
      <AccordionItem className="border-none" value="docs">
        <AccordionTrigger className="py-0 font-medium text-site-foreground/70 text-sm hover:no-underline data-[state=open]:text-site-primary">
          {item.label}
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-0">
          <div className="flex flex-col gap-4">
            <MobileLink
              active={pathname === item.href}
              className="pl-4"
              href={item.href}
              onOpenChange={onOpenChange}
            >
              Introduction
            </MobileLink>
            <Accordion className="w-full pl-4" defaultValue={activeFolders}>
              {tree.children.map((folder) => {
                if (folder.type !== "folder") {
                  return null;
                }

                const pages = getPagesFromFolder(folder, currentBase).filter(
                  (page) => {
                    if (!showMcpDocs && page.url?.includes("/mcp")) {
                      return false;
                    }
                    return true;
                  }
                );

                if (pages.length === 0) {
                  return null;
                }

                return (
                  <AccordionItem
                    className="border-none"
                    key={folder.$id}
                    value={folder.$id ?? ""}
                  >
                    <AccordionTrigger className="py-2 font-medium text-site-foreground/70 text-sm hover:no-underline">
                      {folder.name}
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <div className="flex flex-col gap-2 pt-1 pl-4">
                        {pages.map((page) => {
                          const docsUpdateHint = getDocsPageUpdateHint(
                            page.url
                          );

                          return (
                            <MobileLink
                              active={page.url === pathname}
                              className="flex items-center justify-between gap-3 font-normal text-sm"
                              href={page.url}
                              key={page.url}
                              onOpenChange={onOpenChange}
                            >
                              <span>{page.name}</span>
                              {docsUpdateHint ? (
                                <span className="inline-flex shrink-0 cursor-help items-center">
                                  <span className="sr-only">
                                    {docsUpdateHint}
                                  </span>
                                  <span
                                    aria-hidden="true"
                                    className="site-rounded-full flex size-1.5 bg-blue-500"
                                    title={docsUpdateHint}
                                  />
                                </span>
                              ) : null}
                            </MobileLink>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function MobileNavEntry({
  item,
  pathname,
  tree,
  currentBase,
  activeFolders,
  totalComponentCount,
  componentCategoryLinks,
  onOpenChange,
}: {
  item: MobileNavItem;
  pathname: string;
  tree: MobileNavTree;
  currentBase: string;
  activeFolders: string[];
  totalComponentCount: number;
  componentCategoryLinks: MobileNavCategoryLink[];
  onOpenChange: (open: boolean) => void;
}) {
  if (item.href === "/components") {
    return (
      <MobileComponentsNav
        componentCategoryLinks={componentCategoryLinks}
        item={item}
        onOpenChange={onOpenChange}
        pathname={pathname}
        totalComponentCount={totalComponentCount}
      />
    );
  }

  if (item.href === "/docs") {
    return (
      <MobileDocsNav
        activeFolders={activeFolders}
        currentBase={currentBase}
        item={item}
        onOpenChange={onOpenChange}
        pathname={pathname}
        tree={tree}
      />
    );
  }

  if (item.soon) {
    return (
      <span className="flex items-center gap-2 font-medium text-site-foreground/40 text-sm">
        {item.label}
        <span className="site-rounded-sm bg-site-muted px-1.5 py-0.5 font-medium text-[10px] text-site-muted-foreground leading-none">
          Soon
        </span>
      </span>
    );
  }

  return (
    <MobileLink
      active={isActive(pathname, item.href)}
      href={item.href}
      onOpenChange={onOpenChange}
    >
      {item.label}
    </MobileLink>
  );
}

function MobileLink({
  href,
  onOpenChange,
  className,
  children,
  active,
  ...props
}: LinkProps & {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}) {
  const router = useRouter();
  return (
    <Link
      className={cn(
        "font-medium text-sm transition-colors hover:text-site-primary",
        active ? "text-site-primary" : "text-site-foreground/70",
        className
      )}
      href={href}
      onClick={() => {
        router.push(href.toString());
        onOpenChange?.(false);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}
