"use client";

import {
  ArrowBendDownLeftIcon,
  BookIcon,
  BookOpenIcon,
  DiamondsFourIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import type { ComponentProps } from "react";
import React from "react";
import { useConfig } from "@/hooks/use-config";
import { useIsMac } from "@/hooks/use-is-mac";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import type { source } from "@/lib/source";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/registry/bases/base/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/registry/bases/base/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/bases/base/ui/empty";
import { Kbd, KbdGroup } from "@/registry/bases/base/ui/kbd";
import { Separator } from "@/registry/bases/base/ui/separator";

function setupCommandMenuKeydown(options: {
  copyPayload: string;
  runCommand: (command: () => unknown) => void;
  selectedType: "page" | "component" | null;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}): () => void {
  const { copyPayload, runCommand, selectedType, setOpen } = options;

  const isToggleShortcut = (e: KeyboardEvent) =>
    (e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/";

  const isCopyShortcut = (e: KeyboardEvent) =>
    e.key === "c" && (e.metaKey || e.ctrlKey);

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    if (target.isContentEditable) {
      return true;
    }
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    );
  };

  const down = (e: KeyboardEvent) => {
    if (isToggleShortcut(e)) {
      if (!isEditableTarget(e.target)) {
        e.preventDefault();
        setOpen((prevOpen) => !prevOpen);
      }
      return;
    }

    if (
      isCopyShortcut(e) &&
      (selectedType === "page" || selectedType === "component")
    ) {
      if (copyPayload) {
        posthog.capture("command_menu_command_copied", {
          command: copyPayload,
        });
      }
      runCommand(() => {
        if (navigator.clipboard.writeText) {
          navigator.clipboard.writeText(copyPayload);
        }
      });
    }
  };

  document.addEventListener("keydown", down);
  return () => document.removeEventListener("keydown", down);
}

function CommandMenu({
  tree,
  navItems,
  ...props
}: Omit<ComponentProps<typeof Dialog>, "children"> & {
  tree: typeof source.pageTree;
  navItems?: { href: string; label: string }[];
}) {
  const router = useRouter();
  const isMac = useIsMac();
  const [config] = useConfig();
  const [open, setOpen] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<
    "page" | "component" | null
  >(null);
  const [copyPayload, setCopyPayload] = React.useState("");
  const packageManager = config?.packageManager || "pnpm";

  const handlePageHighlight = React.useCallback(
    (isComponent: boolean, item: { url: string; name?: React.ReactNode }) => {
      if (isComponent) {
        const componentName = item.url.split("/").pop();
        setSelectedType("component");
        const registryItem = `@audio/${componentName}`;
        let cmd: string;
        switch (packageManager) {
          case "pnpm":
            cmd = `pnpm dlx shadcn@latest add ${registryItem}`;
            break;
          case "bun":
            cmd = `bunx --bun shadcn@latest add ${registryItem}`;
            break;
          case "yarn":
            cmd = `yarn dlx shadcn@latest add ${registryItem}`;
            break;
          default:
            cmd = `npx shadcn@latest add ${registryItem}`;
        }

        setCopyPayload(cmd);
      } else {
        setSelectedType("page");
        setCopyPayload("");
      }
    },
    [packageManager]
  );

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  React.useEffect(
    () =>
      setupCommandMenuKeydown({
        copyPayload,
        runCommand,
        selectedType,
        setOpen,
      }),
    [copyPayload, runCommand, selectedType]
  );

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button
            className={cn(
              "relative w-full justify-start pl-3 font-medium text-foreground sm:pr-12 md:w-48 lg:w-60 xl:w-64 dark:bg-card"
            )}
            onClick={() => setOpen(true)}
            variant="outline"
            {...props}
          />
        }
      >
        <span className="hidden lg:inline-flex">Search documentation...</span>
        <span className="inline-flex lg:hidden">Search...</span>

        <div className="absolute top-1.5 right-1.5 hidden gap-1 sm:flex">
          <KbdGroup>
            <Kbd className="border">{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd className="border">K</Kbd>
          </KbdGroup>
        </div>
      </DialogTrigger>
      <DialogHeader className="sr-only">
        <DialogTitle>Search documentation...</DialogTitle>
        <DialogDescription>Search for a command to run...</DialogDescription>
      </DialogHeader>
      <DialogContent
        className="p-1 pb-11 ring-4 ring-border/80"
        showCloseButton={false}
      >
        <Command
          filter={(value, search, keywords) => {
            const extendValue = `${value} ${keywords?.join(" ") || ""}`;
            if (extendValue.toLowerCase().includes(search.toLowerCase())) {
              return 1;
            }
            return 0;
          }}
        >
          <CommandInput placeholder="Search documentation…" />
          <CommandList>
            <CommandEmpty>
              <Empty>
                <EmptyMedia variant="icon">
                  <MagnifyingGlassIcon />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No results found</EmptyTitle>
                  <EmptyDescription>
                    Try searching with different keywords.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CommandEmpty>

            {navItems && navItems.length > 0 && (
              <CommandGroup
                className="p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!"
                heading="Pages"
              >
                {navItems.map((item) => (
                  <CommandMenuItem
                    key={item.href}
                    keywords={["nav", "navigation", item.label.toLowerCase()]}
                    onHighlight={() => {
                      setSelectedType("page");
                      setCopyPayload("");
                    }}
                    onSelect={() => {
                      posthog.capture("command_menu_item_selected", {
                        item_url: item.href,
                        item_name: item.label,
                        item_type: "page",
                      });
                      runCommand(() => router.push(item.href));
                    }}
                    value={`Navigation ${item.label}`}
                  >
                    <BookOpenIcon weight="duotone" />

                    {item.label}
                  </CommandMenuItem>
                ))}
              </CommandGroup>
            )}
            {tree.children.map((group) => (
              <CommandGroup
                className="p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!"
                heading={group.name}
                key={group.$id}
              >
                {group.type === "folder" &&
                  group.children.map((item) => {
                    if (item.type === "page") {
                      const isComponent = item.url.includes("/components/");

                      return (
                        <CommandMenuItem
                          key={item.url}
                          keywords={isComponent ? ["component"] : undefined}
                          onHighlight={() =>
                            handlePageHighlight(isComponent, item)
                          }
                          onSelect={() => {
                            posthog.capture("command_menu_item_selected", {
                              item_url: item.url,
                              item_name: item.name?.toString(),
                              item_type: isComponent ? "component" : "page",
                            });
                            runCommand(() => router.push(item.url));
                          }}
                          value={
                            item.name?.toString()
                              ? `${group.name} ${item.name}`
                              : ""
                          }
                        >
                          {isComponent ? (
                            <DiamondsFourIcon weight="duotone" />
                          ) : (
                            <BookIcon weight="duotone" />
                          )}
                          {item.name}
                        </CommandMenuItem>
                      );
                    }
                    return null;
                  })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center gap-2 rounded-b-4xl border-t border-t-neutral-100 bg-neutral-50 px-4 font-medium text-muted-foreground text-xs dark:border-t-neutral-700 dark:bg-neutral-800">
          <div className="flex items-center gap-2">
            <CommandMenuKbd>
              <ArrowBendDownLeftIcon weight="duotone" />
            </CommandMenuKbd>{" "}
            <span className="truncate">
              {selectedType === "page" || selectedType === "component"
                ? "Go to Page"
                : null}
            </span>
          </div>
          {copyPayload && (
            <>
              <Separator className="self-center! h-5!" orientation="vertical" />
              <div className="flex min-w-0 items-center gap-1">
                <CommandMenuKbd>{isMac ? "⌘" : "Ctrl"}</CommandMenuKbd>
                <CommandMenuKbd>C</CommandMenuKbd>
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
        "h-9 rounded-md border border-transparent px-3! font-medium data-[selected=true]:border-input data-[selected=true]:bg-input/50",
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
        "pointer-events-none flex h-5 select-none items-center justify-center gap-1 rounded border bg-background px-1 font-medium font-sans text-[0.7rem] text-muted-foreground [&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  );
}

export { CommandMenu };
