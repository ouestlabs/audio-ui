"use client";

import { BookOpenTextIcon, CubeIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const pages = items.filter(
    (item) => !(item.soon || item.href.startsWith("https://"))
  );
  const active = pages.find((item) => isActive(pathname, item.href))?.href;

  return (
    <Tabs value={active ?? null}>
      <TabsList
        aria-label="Sections"
        className={cn(
          "w-full",
          !active && "**:data-[slot=tabs-indicator]:hidden"
        )}
      >
        {pages.map((item) => {
          const Icon = ICONS[item.href];
          return (
            <TabsTrigger
              key={item.href}
              nativeButton={false}
              render={<Link href={item.href} />}
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
