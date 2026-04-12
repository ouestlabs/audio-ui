"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import React from "react";
import { PAGES_NEW } from "@/lib/docs";
import type { source } from "@/lib/source";
import { useIsMobile } from "@/registry/default/hooks/use-mobile";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/default/ui/popover";
import { ScrollArea } from "@/registry/default/ui/scroll-area";

const TOP_LEVEL_SECTIONS = [
  { name: "Get Started", href: "/docs" },
  {
    name: "Components",
    href: "/docs/components",
  },
];
export function MobileNav({
  tree,
  items,
  className,
}: {
  tree: typeof source.pageTree;
  items: { href: string; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!isMobile && open) {
      setOpen(false);
    }
  }, [isMobile, open]);

  return (
    <Popover
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        posthog.capture("mobile-nav-toggled", { open: isOpen });
      }}
      open={open && isMobile}
    >
      <PopoverTrigger
        render={
          <Button
            className={cn("extend-touch-target touch-manipulation", className)}
            variant="ghost"
          />
        }
      >
        <div className="relative flex items-center justify-center">
          <div className="relative size-4">
            <span
              className={cn(
                "absolute left-0 block h-0.5 w-4 bg-foreground transition-all duration-100",
                open ? "-rotate-45 top-[0.4rem]" : "top-1"
              )}
            />
            <span
              className={cn(
                "absolute left-0 block h-0.5 w-4 bg-foreground transition-all duration-100",
                open ? "top-[0.4rem] rotate-45" : "top-2.5"
              )}
            />
          </div>
          <span className="sr-only">Toggle Menu</span>
        </div>
        <span className="flex items-center font-medium text-lg leading-none">
          Menu
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="h-(--available-height) w-(--available-width)"
        side="bottom"
        sideOffset={15}
      >
        <ScrollArea>
          <div className="flex flex-col gap-4">
            <div className="font-medium text-muted-foreground text-sm">
              Menu
            </div>
            <div className="flex flex-col gap-3">
              <MobileLink href="/" onOpenChange={setOpen}>
                Home
              </MobileLink>
              {items.map((item, index) => (
                <MobileLink
                  href={item.href}
                  key={String(index)}
                  onOpenChange={setOpen}
                >
                  {item.label}
                </MobileLink>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="font-medium text-muted-foreground text-sm">
              Sections
            </div>
            <div className="flex flex-col gap-3">
              {TOP_LEVEL_SECTIONS.map(({ name, href }) => (
                <MobileLink href={href} key={name} onOpenChange={setOpen}>
                  {name}
                </MobileLink>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-8">
            {tree?.children?.map((group, index) => {
              if (group.type === "folder") {
                return (
                  <div className="flex flex-col gap-4" key={String(index)}>
                    <div className="font-medium text-muted-foreground text-sm">
                      {group.name}
                    </div>
                    <div className="flex flex-col gap-3">
                      {group.children.map((item) => {
                        if (item.type === "page") {
                          return (
                            <MobileLink
                              className="flex items-center gap-2"
                              href={item.url}
                              key={`${item.url}-${index}`}
                              onOpenChange={setOpen}
                            >
                              {item.name}{" "}
                              {PAGES_NEW.includes(item.url) && (
                                <span className="flex size-2 rounded-full bg-primary" />
                              )}
                            </MobileLink>
                          );
                        }
                        if (item.type === "folder") {
                          return (
                            <div
                              className="flex flex-col gap-2 pl-4"
                              key={item.$id}
                            >
                              <div className="font-medium text-muted-foreground text-xs">
                                {item.name}
                              </div>
                              <div className="flex flex-col gap-2">
                                {item.children.map((child) => {
                                  if (child.type === "page") {
                                    return (
                                      <MobileLink
                                        className="flex items-center gap-2 text-xl"
                                        href={child.url}
                                        key={child.url}
                                        onOpenChange={setOpen}
                                      >
                                        {child.name}{" "}
                                        {PAGES_NEW.includes(child.url) && (
                                          <span className="flex size-2 rounded-full bg-primary" />
                                        )}
                                      </MobileLink>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function MobileLink({
  href,
  onOpenChange,
  className,
  children,
  ...props
}: LinkProps & {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Link
      className={cn("font-medium text-2xl", className)}
      href={href}
      onClick={() => {
        posthog.capture("mobile-nav-link-clicked", {
          href: href.toString(),
        });
        router.push(href.toString());
        onOpenChange?.(false);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}
