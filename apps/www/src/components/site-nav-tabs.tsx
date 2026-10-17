"use client";

import { BookOpenTextIcon, CubeIcon } from "@phosphor-icons/react/ssr";
import { Link, useLocation } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, isActive } from "@/lib/utils";

const ICONS: Record<string, typeof CubeIcon> = {
  "/components": CubeIcon,
  "/docs": BookOpenTextIcon,
};

/** The site's sections as tabs: the active one follows the page. */
export function SiteNavTabs({
  items,
}: {
  items: { href: string; label: string; soon?: boolean }[];
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  // Docs first: it is where one starts.
  const pages = items
    .filter((item) => !(item.soon || item.href.startsWith("https://")))
    .toSorted(
      (a, b) => Number(b.href === "/docs") - Number(a.href === "/docs")
    );
  const active = pages.find((item) => isActive(pathname, item.href))?.href;

  return (
    <Tabs value={active ?? null}>
      <TabsList
        aria-label="Sections"
        className={cn(
          "w-full bg-site-foreground/8 **:data-[slot=tabs-indicator]:bg-site-background **:data-[slot=tabs-indicator]:shadow-sm **:data-[slot=tabs-indicator]:ring-1 **:data-[slot=tabs-indicator]:ring-site-foreground/10",
          !active && "**:data-[slot=tabs-indicator]:hidden"
        )}
      >
        {pages.map((item) => {
          const Icon = ICONS[item.href];
          return (
            <TabsTrigger
              key={item.href}
              nativeButton={false}
              render={<Link to={item.href} />}
              value={item.href}
            >
              {Icon ? (
                <Icon
                  aria-hidden
                  className="size-4 in-data-active:text-primary"
                  weight={item.href === active ? "fill" : "regular"}
                />
              ) : null}
              {item.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
