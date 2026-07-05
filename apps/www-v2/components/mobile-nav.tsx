"use client";

import { Menu } from "lucide-react";
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
    tree.children.forEach((item) => {
      if (item.type === "folder") {
        const hasActiveChild = getAllPagesFromFolder(item).some(
          (page) => page.url === pathname
        );
        if (hasActiveChild && item.$id) {
          folders.push(item.$id);
        }
      }
    });
    return folders;
  }, [tree.children, pathname]);

  return (
    <Drawer direction="left" onOpenChange={setOpen} open={open}>
      <DrawerTrigger asChild>
        <Button
          className={cn(
            "extend-touch-target h-8 touch-manipulation items-center justify-start gap-2.5 p-0! hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 active:bg-transparent dark:hover:bg-transparent",
            className
          )}
          variant="ghost"
        >
          <Menu />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-full">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Navigation Menu</DrawerTitle>
          <DrawerDescription>
            Access the main sections and documentation of audio/ui.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-8 overflow-auto px-6 py-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <MobileLink
                active={pathname === "/"}
                href="/"
                onOpenChange={setOpen}
              >
                Home
              </MobileLink>
              {items.map((item, index) => {
                const isDocs = item.href === "/docs";
                const isComponents = item.href === "/components";
                return (
                  <div className="flex flex-col gap-3" key={index}>
                    {isComponents ? (
                      <Accordion
                        className="w-full"
                        collapsible
                        defaultValue={
                          isActive(pathname, "/components")
                            ? "components"
                            : undefined
                        }
                        type="single"
                      >
                        <AccordionItem
                          className="border-none"
                          value="components"
                        >
                          <AccordionTrigger className="py-0 font-medium text-site-foreground/70 text-sm hover:no-underline data-[state=open]:text-site-primary">
                            {item.label}
                          </AccordionTrigger>
                          <AccordionContent className="pt-4 pb-0">
                            <div className="flex flex-col gap-3 pl-4">
                              <MobileLink
                                active={pathname === item.href}
                                className="flex items-center justify-between gap-3 font-normal text-sm"
                                href={item.href}
                                onOpenChange={setOpen}
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
                                      onOpenChange={setOpen}
                                    >
                                      <span>{category.label}</span>
                                      <span className="flex shrink-0 items-center gap-2">
                                        <ComponentUpdateIndicator
                                          category={category.name}
                                        />
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
                    ) : isDocs ? (
                      <Accordion
                        className="w-full"
                        collapsible
                        defaultValue={
                          isActive(pathname, "/docs") ? "docs" : undefined
                        }
                        type="single"
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
                                onOpenChange={setOpen}
                              >
                                Introduction
                              </MobileLink>
                              <Accordion
                                className="w-full pl-4"
                                defaultValue={activeFolders}
                                type="multiple"
                              >
                                {tree.children.map((item) => {
                                  if (item.type !== "folder") return null;

                                  const pages = getPagesFromFolder(
                                    item,
                                    currentBase
                                  ).filter((page) => {
                                    if (
                                      !showMcpDocs &&
                                      page.url?.includes("/mcp")
                                    ) {
                                      return false;
                                    }

                                    return true;
                                  });

                                  if (pages.length === 0) {
                                    return null;
                                  }

                                  return (
                                    <AccordionItem
                                      className="border-none"
                                      key={item.$id}
                                      value={item.$id ?? ""}
                                    >
                                      <AccordionTrigger className="py-2 font-medium text-site-foreground/70 text-sm hover:no-underline">
                                        {item.name}
                                      </AccordionTrigger>
                                      <AccordionContent className="pb-2">
                                        <div className="flex flex-col gap-2 pt-1 pl-4">
                                          {pages.map((page) => {
                                            const docsUpdateHint =
                                              getDocsPageUpdateHint(page.url);

                                            return (
                                              <MobileLink
                                                active={page.url === pathname}
                                                className="flex items-center justify-between gap-3 font-normal text-sm"
                                                href={page.url}
                                                key={page.url}
                                                onOpenChange={setOpen}
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
                    ) : item.soon ? (
                      <span className="flex items-center gap-2 font-medium text-site-foreground/40 text-sm">
                        {item.label}
                        <span className="site-rounded-sm bg-site-muted px-1.5 py-0.5 font-medium text-[10px] text-site-muted-foreground leading-none">
                          Soon
                        </span>
                      </span>
                    ) : (
                      <MobileLink
                        active={isActive(pathname, item.href)}
                        href={item.href}
                        onOpenChange={setOpen}
                      >
                        {item.label}
                      </MobileLink>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
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
