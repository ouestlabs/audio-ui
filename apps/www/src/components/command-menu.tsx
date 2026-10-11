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
import { useRouter } from "next/navigation";
import * as React from "react";
import { copyToClipboardWithMeta } from "@/components/copy-button";
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
  const [selectedType, setSelectedType] = React.useState<
    "color" | "page" | "component" | "category" | null
  >(null);
  const [copyPayload, setCopyPayload] = React.useState("");
  const packageManager = config.packageManager || "pnpm";

  const handlePageHighlight = React.useCallback(
    (isComponent: boolean, item: { url: string; name?: React.ReactNode }) => {
      if (isComponent) {
        const componentName = item.url.split("/").pop();
        setSelectedType("component");
        setCopyPayload(
          `${packageManager} dlx shadcn@latest add ${componentName}`
        );
      } else {
        setSelectedType("page");
        setCopyPayload("");
      }
    },
    [packageManager]
  );

  const handleCategoryHighlight = React.useCallback(() => {
    setSelectedType("category");
    setCopyPayload("");
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const copyStateRef = React.useRef({
    copyPayload,
    packageManager,
    selectedType,
  });
  React.useEffect(() => {
    copyStateRef.current = { copyPayload, packageManager, selectedType };
  }, [selectedType, copyPayload, packageManager]);

  const copyHighlightedPayload = React.useCallback(() => {
    const current = copyStateRef.current;

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
            className="justify-between gap-2 pr-1.5"
            onClick={() => setOpen(true)}
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
        className="site-rounded-xl max-h-[calc(100dvh-1.5rem)] border-none max-sm:pt-12 bg-clip-padding bg-site-background p-2 pb-11 shadow-2xl ring-4 ring-site-border/60 max-sm:top-3 max-sm:max-w-[calc(100%-1.5rem)] max-sm:translate-y-0 sm:max-w-xl **:data-[slot=command-item]:data-selected:bg-site-muted **:data-[slot=command-item]:max-sm:py-2.5 **:data-[slot=command-input]:max-sm:text-base **:data-[slot=command]:bg-transparent **:data-[slot=input-group]:max-sm:h-11!"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search...</DialogTitle>
          <DialogDescription>Search for a command to run...</DialogDescription>
        </DialogHeader>
        {/* On a phone the dialog covers the screen, with no backdrop to tap: a title bar, and a way out after the field in the tab order. */}
        <div className="absolute inset-x-0 top-0 z-20 flex h-10 items-center rounded-t-[12px] border-b border-b-site-border bg-site-muted px-4 font-medium text-site-muted-foreground text-xs sm:hidden">
          Search
        </div>
        <Command
          filter={(value, search, keywords) => {
            const extendValue = `${value} ${keywords?.join(" ") || ""}`;
            if (extendValue.toLowerCase().includes(search.toLowerCase())) {
              return 1;
            }
            return 0;
          }}
        >
          <CommandInput placeholder="Search..." />
          <CommandList className="no-scrollbar scroll-fade min-h-0 scroll-pt-2 scroll-pb-1.5 max-sm:max-h-[calc(100dvh-9rem)] sm:min-h-80">
            <CommandEmpty className="py-12 text-center text-site-muted-foreground text-sm">
              No results found.
            </CommandEmpty>
            {navItems && navItems.length > 0 && (
              <CommandGroup
                className="p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!"
                heading="Pages"
              >
                {navItems.map((item) => (
                  <CommandMenuItem
                    disabled={item.soon}
                    key={item.href}
                    keywords={["nav", "navigation", item.label.toLowerCase()]}
                    onHighlight={() => {
                      setSelectedType("page");
                      setCopyPayload("");
                    }}
                    onSelect={() => {
                      if (!item.soon) {
                        runCommand(() => router.push(item.href));
                      }
                    }}
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
                    {item.soon && (
                      <span className="site-rounded-sm ml-auto bg-site-muted px-1.5 py-0.5 font-medium text-[10px] text-site-muted-foreground leading-none">
                        Soon
                      </span>
                    )}
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
                    key={item.url}
                    keywords={item.isComponent ? ["component"] : undefined}
                    onHighlight={() =>
                      handlePageHighlight(item.isComponent, item)
                    }
                    onSelect={() => {
                      runCommand(() => router.push(item.url));
                    }}
                    value={item.name ? `${group.name} ${item.name}` : ""}
                  >
                    {item.isComponent ? (
                      <DiamondsFourIcon weight="fill" />
                    ) : (
                      <BookIcon weight="fill" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
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
                    key={`component-cat-${category.name}`}
                    keywords={[
                      "component",
                      "category",
                      category.name,
                      category.label,
                    ]}
                    onHighlight={handleCategoryHighlight}
                    onSelect={() => {
                      runCommand(() =>
                        router.push(
                          `/components/${normalizeSlug(category.name)}`
                        )
                      );
                    }}
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
        </Command>
        <DialogClose
          render={
            <Button
              aria-label="Close search"
              className="absolute top-1 right-2 z-30 sm:hidden"
              size="icon"
              variant="ghost"
            >
              <XIcon aria-hidden weight="bold" />
            </Button>
          }
        />
        <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center gap-2 rounded-b-[12px] border-t border-t-site-border bg-site-muted px-4 font-medium text-site-muted-foreground text-xs">
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
          {copyPayload && (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandMenuItem({
  children,
  className,
  onHighlight,
  ...props
}: React.ComponentProps<typeof CommandItem> & {
  onHighlight?: () => void;
  "data-selected"?: string;
  "aria-selected"?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onHighlight?.();
      }
    }
  });

  return (
    <CommandItem
      className={cn(
        "site-rounded-md h-9 border border-transparent px-3! font-medium data-[selected=true]:border-site-input data-[selected=true]:bg-site-input/50",
        className
      )}
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
