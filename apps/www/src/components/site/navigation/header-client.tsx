import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import type { CommandMenuGroup } from "@/components/site/navigation/command-menu";
import { Button } from "@/components/ui/button";
import { lazyComponent } from "@/lib/lazy";

const CommandMenu = lazyComponent(
  () =>
    import("@/components/site/navigation/command-menu").then(
      (mod) => mod.CommandMenu
    ),
  {
    loading: () => (
      <Button
        aria-hidden="true"
        className="relative w-full justify-start bg-transparent pl-2! font-medium text-site-foreground shadow-none sm:pr-12 md:w-21"
        disabled
        tabIndex={-1}
        variant="secondary"
      >
        <MagnifyingGlassIcon className="size-4 shrink-0 opacity-60" />
      </Button>
    ),
  }
);

const MobileNav = lazyComponent(
  () =>
    import("@/components/site/navigation/mobile-nav").then(
      (mod) => mod.MobileNav
    ),
  {
    loading: () => <div aria-hidden="true" className="size-8 lg:hidden" />,
  }
);

const ModeSwitcher = lazyComponent(
  () =>
    import("@/components/site/navigation/mode-switcher").then(
      (mod) => mod.ModeSwitcher
    ),
  {
    loading: () => <div aria-hidden="true" className="size-8" />,
  }
);

type HeaderTree = unknown;

export function SiteHeaderMobileNav({
  tree,
  navItems,
}: {
  tree: HeaderTree;
  navItems: { href: string; label: string; soon?: boolean }[];
}) {
  return (
    <MobileNav
      className="flex lg:hidden"
      items={navItems}
      tree={tree as never}
    />
  );
}

export function SiteHeaderCommandMenu({
  navItems,
  commandGroups,
}: {
  navItems: { href: string; label: string; soon?: boolean }[];
  commandGroups: CommandMenuGroup[];
}) {
  return <CommandMenu groups={commandGroups} navItems={navItems} />;
}

export function SiteHeaderModeSwitcher() {
  return <ModeSwitcher />;
}
