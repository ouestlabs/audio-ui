"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isActive } from "@/lib/utils";

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
      <TabsList aria-label="Sections" className="w-full">
        {pages.map((item) => (
          <TabsTrigger
            key={item.href}
            nativeButton={false}
            render={<Link href={item.href} />}
            value={item.href}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
