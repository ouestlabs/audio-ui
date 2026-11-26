import { Link } from "@tanstack/react-router";
import { ExpandEditor } from "@/components/site/home/expand-editor";
import { DawLink } from "@/components/site/navigation/daw-link";
import { FrameworkSelect } from "@/components/site/navigation/framework-select";
import { GitHubLink } from "@/components/site/navigation/github-link";
import {
  SiteHeaderCommandMenu,
  SiteHeaderMobileNav,
  SiteHeaderModeSwitcher,
} from "@/components/site/navigation/header-client";
import { LabLink } from "@/components/site/navigation/lab-link";
import { MainNav } from "@/components/site/navigation/main-nav";
import { SectionSelect } from "@/components/site/navigation/section-select";
import { Wordmark } from "@/components/site/navigation/wordmark";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/lib/config";
import { buildCommandMenuGroups } from "@/lib/docs/content/command-groups";
import type { source } from "@/lib/docs/content/source";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";

// The tree the layout's loader reads on the server. Reading `source` here would ship every docs page and its demos to every page.
type PageTree = ReturnType<typeof source.getPageTree>;

function SiteLogo() {
  return (
    <Button
      // pl-2: the icon's built-in margin plus its round edge make 10px read wider than the right side
      className="pl-2"
      render={
        <Link aria-label="audio/ui home" className="flex items-center" to="/">
          <Wordmark className="text-foreground text-xl" />
        </Link>
      }
      variant="ghost"
    />
  );
}

/**
 * From `lg`, the framed layouts have no header: this is what it held, at the
 * top of the navigation sidebar: the logo, the theme, the section menu, the
 * framework menu and the search. GitHub stays in the inset's bar.
 */
export function SiteSidebarHeader({ tree }: { tree: PageTree }) {
  const commandGroups = buildCommandMenuGroups(tree.children);

  return (
    <div className="flex shrink-0 flex-col gap-2 p-2 font-site-sans">
      <div className="flex items-center justify-between gap-2">
        <SiteLogo />
        <SiteHeaderModeSwitcher />
      </div>
      <SectionSelect tree={tree} />
      <FrameworkSelect />
      <div className="*:w-full">
        <SiteHeaderCommandMenu
          commandGroups={commandGroups}
          navItems={siteConfig.navItems}
        />
      </div>
    </div>
  );
}

/**
 * What the navigation sidebar's header holds, for the bar of the inset while
 * that sidebar is shut: the section menu at the start, the search, GitHub and
 * the theme at the end.
 */
export function SiteBarContent(
  props: { part: "github" } | { part: "end" | "start"; tree: PageTree }
) {
  if (props.part === "github") {
    return (
      <>
        <ExpandEditor />
        <LabLink />
        <DawLink />
        <GitHubLink />
      </>
    );
  }
  if (props.part === "start") {
    return (
      <div className="flex items-center gap-2">
        <SectionSelect compact tree={props.tree} />
        <FrameworkSelect compact />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="shrink-0">
        <SiteHeaderCommandMenu
          commandGroups={buildCommandMenuGroups(props.tree.children)}
          navItems={siteConfig.navItems}
        />
      </div>
      <SiteHeaderModeSwitcher />
    </div>
  );
}

export function SiteHeader({
  framed = false,
  sticky = true,
  tree,
}: {
  /** The page has a framed layout: from `lg` its navigation sidebar holds the header's content, so there is no header. */
  framed?: boolean;
  sticky?: boolean;
  /** The docs' pages, for the search and the mobile menu. Without it, they list the sections only. */
  tree?: PageTree;
} = {}) {
  const commandGroups = tree ? buildCommandMenuGroups(tree.children) : [];

  return (
    <header
      className={cn(
        "w-full overscroll-none bg-site-background font-site-sans",
        framed && "lg:hidden",
        sticky && "sticky top-0 z-40"
      )}
    >
      <div className="container-wrapper">
        <div className="flex h-[calc(var(--header-height)-1px)] items-center gap-3.5">
          {tree ? (
            <SiteHeaderMobileNav navItems={siteConfig.navItems} tree={tree} />
          ) : null}
          <Button
            className="hidden pl-2 md:flex"
            render={
              <Link
                aria-label="audio/ui home"
                className="flex items-center"
                to="/"
              >
                <Wordmark className="text-foreground text-xl sm:text-2xl" />
              </Link>
            }
            variant="ghost"
          />
          <MainNav className="hidden lg:flex" items={siteConfig.navItems} />
          <div className="ml-auto flex items-center gap-2">
            <SiteHeaderCommandMenu
              commandGroups={commandGroups}
              navItems={siteConfig.navItems}
            />
            <Separator className="hidden sm:flex" orientation="vertical" />
            <div className="flex items-center gap-1">
              <LabLink />
              <DawLink />
              <GitHubLink />
              <SiteHeaderModeSwitcher />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
