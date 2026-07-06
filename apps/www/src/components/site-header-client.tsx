"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import dynamic from "next/dynamic";
import type { CommandMenuGroup } from "@/components/command-menu";
import { Button } from "@/components/ui/button";
import type { CategoryInfo } from "@/lib/registry";

const CommandMenu = dynamic(
  () => import("@/components/command-menu").then((mod) => mod.CommandMenu),
  {
    ssr: false,
    loading: () => (
      <Button
        aria-hidden="true"
        className="relative h-8 w-full justify-start bg-transparent pl-2! font-medium text-site-foreground shadow-none sm:pr-12 md:w-21"
        disabled
        variant="secondary"
      >
        <MagnifyingGlassIcon className="size-4 shrink-0 opacity-60" />
      </Button>
    ),
  }
);

const MobileNav = dynamic(
  () => import("@/components/mobile-nav").then((mod) => mod.MobileNav),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className="size-8 lg:hidden" />,
  }
);

const ModeSwitcher = dynamic(
  () => import("@/components/mode-switcher").then((mod) => mod.ModeSwitcher),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className="size-8" />,
  }
);

type HeaderTree = unknown;

export function SiteHeaderMobileNav({
  tree,
  navItems,
  componentCategories,
}: {
  tree: HeaderTree;
  navItems: { href: string; label: string; soon?: boolean }[];
  componentCategories: CategoryInfo[];
}) {
  return (
    <MobileNav
      className="flex lg:hidden"
      componentCategories={componentCategories}
      items={navItems}
      tree={tree as never}
    />
  );
}

export function SiteHeaderCommandMenu({
  navItems,
  componentCategories,
  commandGroups,
}: {
  navItems: { href: string; label: string; soon?: boolean }[];
  componentCategories: CategoryInfo[];
  commandGroups: CommandMenuGroup[];
}) {
  return (
    <CommandMenu
      componentCategories={componentCategories}
      groups={commandGroups}
      navItems={navItems}
    />
  );
}

export function SiteHeaderModeSwitcher() {
  return <ModeSwitcher />;
}
