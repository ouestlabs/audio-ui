"use client";

import type { DialogProps } from "@radix-ui/react-dialog";
import { IconArrowRight } from "@tabler/icons-react";
import {
  CornerDownLeftIcon,
  LayoutGridIcon,
  SearchIcon,
  SquareDashedIcon,
} from "lucide-react";
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

export type CommandMenuGroup = {
  id: string;
  name: string;
  pages: CommandPage[];
};

export function CommandMenu({
  groups,
  navItems,
  componentCategories = [],
  ...props
}: DialogProps & {
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
    [packageManager, setSelectedType, setCopyPayload]
  );

  const handleCategoryHighlight = React.useCallback(() => {
    setSelectedType("category");
    setCopyPayload("");
  }, [setSelectedType, setCopyPayload]);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }

        e.preventDefault();
        setOpen((open) => !open);
      }

      if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
        runCommand(() => {
          if (selectedType === "color") {
            copyToClipboardWithMeta(copyPayload, {
              name: "copy_command",
              properties: { color: copyPayload },
            });
          }

          if (selectedType === "page" || selectedType === "component") {
            copyToClipboardWithMeta(copyPayload, {
              name: "copy_command",
              properties: { command: copyPayload, pm: packageManager },
            });
          }
        });
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [copyPayload, runCommand, selectedType, packageManager]);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className={cn(
            "relative h-8 w-full justify-start bg-transparent pl-2! font-medium text-site-foreground shadow-none sm:pr-12 md:w-21"
          )}
          onClick={() => setOpen(true)}
          variant="secondary"
          {...props}
        >
          <SearchIcon className="size-4 shrink-0 opacity-60" />
          <div className="absolute top-1.5 right-1.5 hidden gap-1 sm:flex">
            <KbdGroup>
              <Kbd className="border">{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd className="border">K</Kbd>
            </KbdGroup>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="site-rounded-xl border-none bg-clip-padding p-2 pb-11 shadow-2xl ring-4 ring-neutral-200/80 dark:bg-neutral-900 dark:ring-neutral-800"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search...</DialogTitle>
          <DialogDescription>Search for a command to run...</DialogDescription>
        </DialogHeader>
        <Command
          className="site-rounded-none **:data-[slot=command-input-wrapper]:site-rounded-md bg-transparent **:data-[slot=command-input-wrapper]:mb-0 **:data-[slot=command-input-wrapper]:h-9! **:data-[slot=command-input]:h-9! **:data-[slot=command-input-wrapper]:border **:data-[slot=command-input-wrapper]:border-site-input **:data-[slot=command-input-wrapper]:bg-site-input/50 **:data-[slot=command-input]:py-0"
          filter={(value, search, keywords) => {
            const extendValue = value + " " + (keywords?.join(" ") || "");
            if (extendValue.toLowerCase().includes(search.toLowerCase())) {
              return 1;
            }
            return 0;
          }}
        >
          <CommandInput placeholder="Search..." />
          <CommandList className="no-scrollbar min-h-80 scroll-pt-2 scroll-pb-1.5">
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
                    <IconArrowRight />
                    <span className={cn(item.soon && "opacity-50")}>
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
                      <SquareDashedIcon />
                    ) : (
                      <IconArrowRight />
                    )}
                    {item.name}
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
                    <LayoutGridIcon />
                    {category.label}
                  </CommandMenuItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center gap-2 rounded-b-[12px] border-t border-t-neutral-100 bg-neutral-50 px-4 font-medium text-site-muted-foreground text-xs dark:border-t-neutral-700 dark:bg-neutral-800">
          <div className="flex items-center gap-2">
            <CommandMenuKbd>
              <CornerDownLeftIcon />
            </CommandMenuKbd>{" "}
            {selectedType === "page" || selectedType === "component"
              ? "Go to Page"
              : null}
            {selectedType === "category" ? "View Category" : null}
            {selectedType === "color" ? "Copy OKLCH" : null}
          </div>
          {copyPayload && (
            <>
              <Separator className="h-4!" orientation="vertical" />
              <div className="flex items-center gap-1">
                <CommandMenuKbd>{isMac ? "⌘" : "Ctrl"}</CommandMenuKbd>
                <CommandMenuKbd>C</CommandMenuKbd>
                {copyPayload}
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
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onHighlight?.();
      }
    });
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
