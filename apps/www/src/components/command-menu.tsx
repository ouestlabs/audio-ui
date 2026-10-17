"use client";

import {
  ArrowBendDownLeftIcon,
  BookIcon,
  BookOpenIcon,
  DiamondsFourIcon,
  MagnifyingGlassIcon,
  SquaresFourIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { useRouter } from "@tanstack/react-router";
import * as React from "react";
import { ComponentEmptyState } from "@/components/catalog/component-empty-state";
import { copyToClipboardWithMeta } from "@/components/copy-button";
import {
  FrameContent,
  FrameFooter,
  FrameHeader,
} from "@/components/custom/frame";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { useConfig } from "@/hooks/use-config";
import { useIsMac } from "@/hooks/use-is-mac";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import type { CategoryInfo } from "@/lib/registry";
import { cn, normalizeSlug } from "@/lib/utils";

type CommandPage = {
  url: string;
  name: string;
  isComponent: boolean;
};

function isEditableTarget(target: EventTarget | null) {
  return (
    (target instanceof HTMLElement && target.isContentEditable) ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

type HighlightType = "color" | "page" | "component" | "category";

/** Whether an entry matches what is typed, its keywords included: 1 or 0, as the command list ranks. */
const matchesSearch = (value: string, search: string, keywords?: string[]) =>
  `${value} ${keywords?.join(" ") ?? ""}`
    .toLowerCase()
    .includes(search.toLowerCase())
    ? 1
    : 0;

export type CommandMenuGroup = {
  id: string;
  name: string;
  pages: CommandPage[];
};

const NO_COMPONENT_CATEGORIES: CategoryInfo[] = [];

export function CommandMenu({
  groups,
  navItems,
  componentCategories = NO_COMPONENT_CATEGORIES,
}: {
  groups: CommandMenuGroup[];
  navItems?: { href: string; label: string; soon?: boolean }[];
  componentCategories?: CategoryInfo[];
}) {
  const router = useRouter();
  const isMac = useIsMac();
  const [config] = useConfig();
  const [open, setOpen] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<HighlightType | null>(
    null
  );
  const [copyPayload, setCopyPayload] = React.useState("");
  const packageManager = config.packageManager || "pnpm";

  const highlight = React.useCallback(
    (type: HighlightType, payload: string) => {
      setSelectedType(type);
      setCopyPayload(payload);
    },
    []
  );

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const navigate = React.useCallback(
    (href: string) => runCommand(() => router.navigate({ href })),
    [router, runCommand]
  );

  const copyStateRef = React.useRef({
    copyPayload,
    packageManager,
    selectedType,
  });
  React.useEffect(() => {
    copyStateRef.current = { copyPayload, packageManager, selectedType };
  }, [selectedType, copyPayload, packageManager]);

  const copyHighlightedPayload = React.useCallback(() => {
    const { current } = copyStateRef;

    if (current.selectedType === "color") {
      copyToClipboardWithMeta(current.copyPayload, {
        name: "copy_command",
        properties: { color: current.copyPayload },
      });
    }

    if (
      current.selectedType === "page" ||
      current.selectedType === "component"
    ) {
      copyToClipboardWithMeta(current.copyPayload, {
        name: "copy_command",
        properties: {
          command: current.copyPayload,
          pm: current.packageManager,
        },
      });
    }
  }, []);

  const onCopyShortcut = React.useEffectEvent(() => {
    runCommand(copyHighlightedPayload);
  });

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        // The menu is mounted in several places (header, sidebar, bar): the first to hear the key opens its own, the others leave it.
        if (e.defaultPrevented || isEditableTarget(e.target)) {
          return;
        }

        e.preventDefault();
        setOpen((isOpen) => !isOpen);
      }

      if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
        onCopyShortcut();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label="Search"
            className="justify-between gap-2 bg-site-foreground/8 pr-1.5 hover:bg-site-foreground/12"
            variant="secondary"
          >
            <MagnifyingGlassIcon aria-hidden className="shrink-0 opacity-60" />
            <KbdGroup>
              <Kbd className="border">{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd className="border">K</Kbd>
            </KbdGroup>
          </Button>
        }
      />
      <DialogContent
        className="flex max-h-[calc(100dvh-1.5rem)] flex-col max-sm:h-[calc(100dvh-1.5rem)] gap-0 overflow-hidden rounded-(--frame-radius) border border-site-border/80 bg-[color-mix(in_oklab,var(--site-muted)_50%,var(--site-background))] p-0.5 shadow-2xl ring-0 max-sm:top-3 max-sm:max-w-[calc(100%-1.5rem)] max-sm:translate-y-0 sm:max-w-xl **:data-[slot=command-item]:data-selected:bg-site-muted **:data-[slot=command-item]:max-sm:py-2.5 **:data-[slot=command]:bg-transparent"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search…</DialogTitle>
          <DialogDescription>Search for a command to run…</DialogDescription>
        </DialogHeader>
        <Command
          className="min-h-0 flex-1 gap-0 rounded-none! p-0"
          filter={matchesSearch}
        >
          <FrameHeader className="shrink-0 flex-row items-center gap-1 p-1 **:data-[slot=command-input-wrapper]:flex-1 **:data-[slot=command-input-wrapper]:p-0">
            <CommandInput placeholder="Search…" />
            <DialogClose
              render={
                <Button
                  aria-label="Close search"
                  className="sm:hidden"
                  size="icon-sm"
                  variant="ghost"
                >
                  <XIcon aria-hidden weight="bold" />
                </Button>
              }
            />
          </FrameHeader>
          <FrameContent className="flex min-h-0 flex-1 flex-col rounded-(--frame-radius-inner) p-1">
            <CommandList className="no-scrollbar scroll-fade min-h-0 flex-1 scroll-pt-2 scroll-pb-1.5 max-sm:max-h-none sm:min-h-80 sm:flex-none">
              <CommandEmpty className="flex h-full min-h-80 p-0">
                <ComponentEmptyState
                  className="m-1"
                  description="Try another word, such as a component, a device or a page."
                  title="No results found"
                />
              </CommandEmpty>
              {navItems && navItems.length > 0 && (
                <CommandGroup
                  className="p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!"
                  heading="Pages"
                >
                  {navItems.map((item) => (
                    <CommandMenuItem
                      disabled={item.soon}
                      highlightType="page"
                      href={item.soon ? undefined : item.href}
                      key={item.href}
                      keywords={["nav", "navigation", item.label.toLowerCase()]}
                      onHighlight={highlight}
                      onNavigate={navigate}
                      value={`Navigation ${item.label}`}
                    >
                      <BookOpenIcon weight="fill" />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          item.soon && "opacity-50"
                        )}
                      >
                        {item.label}
                      </span>
                      {item.soon ? (
                        <span className="site-rounded-sm ml-auto bg-site-muted px-1.5 py-0.5 font-medium text-[10px] text-site-muted-foreground leading-none">
                          Soon
                        </span>
                      ) : null}
                    </CommandMenuItem>
                  ))}
                </CommandGroup>
              )}
              {groups.map((group) => (
                <CommandGroup
                  className="p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!"
                  heading={group.name}
                  key={group.id}
                >
                  {group.pages.map((item) => (
                    <CommandMenuItem
                      highlightPayload={
                        item.isComponent
                          ? `${packageManager} dlx shadcn@latest add ${item.url.split("/").pop()}`
                          : ""
                      }
                      highlightType={item.isComponent ? "component" : "page"}
                      href={item.url}
                      key={item.url}
                      keywords={item.isComponent ? ["component"] : undefined}
                      onHighlight={highlight}
                      onNavigate={navigate}
                      value={item.name ? `${group.name} ${item.name}` : ""}
                    >
                      {item.isComponent ? (
                        <DiamondsFourIcon weight="fill" />
                      ) : (
                        <BookIcon weight="fill" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {item.name}
                      </span>
                    </CommandMenuItem>
                  ))}
                </CommandGroup>
              ))}
              {componentCategories.length > 0 && (
                <CommandGroup
                  className="p-0! **:[[cmdk-group-heading]]:p-3!"
                  heading="Components"
                >
                  {componentCategories.map((category) => (
                    <CommandMenuItem
                      highlightType="category"
                      href={`/components/${normalizeSlug(category.name)}`}
                      key={`component-cat-${category.name}`}
                      keywords={[
                        "component",
                        "category",
                        category.name,
                        category.label,
                      ]}
                      onHighlight={highlight}
                      onNavigate={navigate}
                      value={`Component category ${category.label}`}
                    >
                      <SquaresFourIcon weight="fill" />
                      <span className="min-w-0 flex-1 truncate">
                        {category.label}
                      </span>
                    </CommandMenuItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </FrameContent>
        </Command>
        <FrameFooter className="h-10 shrink-0 flex-row items-center gap-2 px-3 py-0 font-medium text-site-muted-foreground text-xs">
          <div className="flex shrink-0 items-center gap-2">
            <CommandMenuKbd>
              <ArrowBendDownLeftIcon weight="fill" />
            </CommandMenuKbd>{" "}
            {selectedType === "page" || selectedType === "component"
              ? "Go to Page"
              : null}
            {selectedType === "category" ? "View Category" : null}
            {selectedType === "color" ? "Copy OKLCH" : null}
          </div>
          {copyPayload ? (
            <>
              <Separator orientation="vertical" />
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <CommandMenuKbd className="shrink-0">
                  {isMac ? "⌘" : "Ctrl"}
                </CommandMenuKbd>
                <CommandMenuKbd className="shrink-0">C</CommandMenuKbd>
                <span className="truncate">{copyPayload}</span>
              </div>
            </>
          ) : null}
        </FrameFooter>
      </DialogContent>
    </Dialog>
  );
}

/** An entry of the menu: highlighting it shows what Enter and Ctrl+C do, selecting it goes to `href`. */
function CommandMenuItem({
  children,
  className,
  highlightPayload = "",
  highlightType,
  href,
  onHighlight,
  onNavigate,
  ...props
}: React.ComponentProps<typeof CommandItem> & {
  highlightPayload?: string;
  highlightType: HighlightType;
  href?: string;
  onHighlight: (type: HighlightType, payload: string) => void;
  onNavigate: (href: string) => void;
  "data-selected"?: string;
  "aria-selected"?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const handleSelect = React.useCallback(() => {
    if (href) {
      onNavigate(href);
    }
  }, [href, onNavigate]);

  useMutationObserver(ref, (mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onHighlight(highlightType, highlightPayload);
      }
    }
  });

  return (
    <CommandItem
      className={cn(
        "site-rounded-md h-9 border border-transparent px-3! font-medium data-[selected=true]:border-site-input data-[selected=true]:bg-site-input/50",
        className
      )}
      onSelect={handleSelect}
      ref={ref}
      {...props}
    >
      {children}
    </CommandItem>
  );
}

function CommandMenuKbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "site-rounded-sm pointer-events-none flex h-5 select-none items-center justify-center gap-1 border border-site-border bg-site-background px-1 font-medium font-site-sans text-[0.7rem] text-site-muted-foreground [&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  );
}
