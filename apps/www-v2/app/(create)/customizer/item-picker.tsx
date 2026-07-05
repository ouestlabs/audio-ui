"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";
import type { RegistryItem } from "shadcn/schema";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { groupItemsByType } from "@/app/(create)/lib/utils";
import { PreviewShortcutForwarder } from "@/components/preview-shortcut-forwarder";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { useConfig } from "@/hooks/use-config";

export const CMD_K_FORWARD_TYPE = "cmd-k-forward";

const ITEM_PICKER_KEYS = ["k", "p"] as const;

const cachedGroupedItems = React.cache(
  (items: Pick<RegistryItem, "name" | "title" | "type">[]) =>
    groupItemsByType(items)
);

export function ItemPicker({
  items,
}: {
  items: Pick<RegistryItem, "name" | "title" | "type">[];
}) {
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const groupedItems = React.useMemo(() => cachedGroupedItems(items), [items]);

  const itemValue = params.item ?? config.item;
  const currentItem = React.useMemo(
    () => items.find((item) => item.name === itemValue) ?? null,
    [items, itemValue]
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "p") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = React.useCallback(
    (item: Pick<RegistryItem, "name" | "title" | "type">) => {
      setParams({ item: item.name });
      setConfig((prev) => ({ ...prev, item: item.name }));
      setOpen(false);
    },
    [setParams, setConfig]
  );

  const comboboxValue = React.useMemo(() => currentItem ?? null, [currentItem]);

  return (
    <Combobox
      autoHighlight
      items={groupedItems}
      itemToStringValue={(item) => {
        if (!item) {
          return "";
        }
        // Handle both groups and items.
        if ("items" in item) {
          return item.title ?? "";
        }
        return item.title ?? item.name ?? "";
      }}
      onOpenChange={setOpen}
      onValueChange={(value) => {
        if (value) {
          handleSelect(value);
        }
      }}
      open={open}
      value={comboboxValue}
    >
      <ComboboxTrigger
        render={
          <Button
            aria-label="Select item"
            className="site-rounded-xl sm:site-rounded-lg h-[calc(--spacing(13.5))] flex-1 touch-manipulation select-none justify-between gap-2 border-site-foreground/10 bg-site-muted/50 pr-4! pl-2.5 text-left shadow-none data-popup-open:bg-site-muted *:data-[slot=combobox-trigger-icon]:hidden sm:h-8 sm:max-w-56 sm:bg-site-background sm:pr-2! xl:max-w-64 dark:bg-site-muted/50 md:dark:bg-site-background dark:data-popup-open:bg-site-muted/50"
            size="sm"
            variant="outline"
          />
        }
      >
        <ComboboxValue>
          {(value) => (
            <>
              <div className="flex flex-col justify-start text-left sm:hidden">
                <div className="font-normal text-site-muted-foreground text-xs">
                  Preview
                </div>
                <div className="font-medium text-site-foreground text-sm">
                  {mounted ? value?.title || "Not Found" : "..."}
                </div>
              </div>
              <div className="hidden flex-1 text-site-foreground text-sm sm:flex">
                {mounted ? value?.title || "Not Found" : "..."}
              </div>
            </>
          )}
        </ComboboxValue>
        <HugeiconsIcon icon={Search01Icon} />
      </ComboboxTrigger>
      <ComboboxContent
        align="end"
        className="site-rounded-xl min-w-[calc(var(--available-width)---spacing(4))] translate-x-2 animate-none border-0 ring-1 ring-site-foreground/10 data-open:animate-none sm:min-w-[calc(var(--anchor-width)+--spacing(7))] sm:translate-x-0 xl:w-96"
        side="bottom"
      >
        <ComboboxInput
          className="site-rounded-lg pointer-coarse:hidden h-8 bg-site-muted shadow-none has-focus-visible:border-inherit! has-focus-visible:ring-0!"
          placeholder="Search"
          showTrigger={false}
        />
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList className="no-scrollbar scroll-my-1 pb-1">
          {(group) => (
            <ComboboxGroup items={group.items} key={group.type}>
              <ComboboxLabel>{group.title}</ComboboxLabel>
              <ComboboxCollection>
                {(item) => (
                  <ComboboxItem
                    className="group/combobox-item site-rounded-lg pointer-coarse:py-2.5 pointer-coarse:pl-3 pointer-coarse:text-base"
                    key={item.name}
                    value={item}
                  >
                    {item.title}
                    <span className="ml-auto text-site-muted-foreground text-xs opacity-0 group-data-[selected=true]/combobox-item:opacity-100">
                      {group.title}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
      <div
        className="fixed inset-0 z-50 hidden bg-transparent data-[open=true]:block"
        data-open={open}
        onClick={() => setOpen(false)}
      />
    </Combobox>
  );
}

export function ItemPickerScript() {
  return (
    <PreviewShortcutForwarder
      forwardType={CMD_K_FORWARD_TYPE}
      keys={ITEM_PICKER_KEYS}
      requireModifier
    />
  );
}
