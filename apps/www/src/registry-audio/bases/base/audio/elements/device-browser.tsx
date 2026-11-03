"use client";

import {
  type ChangeEvent,
  type ComponentProps,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
  useCallback,
  useId,
  useState,
} from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/registry/bases/base/ui/input-group";
import { DEVICE_DRAG_TYPE } from "@/registry-audio/bases/base/audio/elements/device-chain";

/** A device as the library lists it: a device definition is one. */
export interface DeviceBrowserItem {
  description?: string;
  id: string;
  name: string;
}

/** A shelf of the library: devices that do the same kind of job. */
export interface DeviceBrowserShelf {
  items: readonly DeviceBrowserItem[];
  label: string;
}

/** How well a device answers a search: its name first, then what it does; -1 when it does not. */
function rank(item: DeviceBrowserItem, query: string) {
  const name = item.name.toLowerCase();
  if (name.startsWith(query)) {
    return 0;
  }
  if (name.includes(query)) {
    return 1;
  }
  return item.description?.toLowerCase().includes(query) ? 2 : -1;
}

interface DeviceBrowserProps
  extends Omit<ComponentProps<"section">, "onChange"> {
  /** Called to open or fold the library. Leave it out and it stays open, with no button to fold it. */
  onOpenChange?: (open: boolean) => void;
  /** A device was picked: its id. Enter, a double-click or the Add button. */
  onPick: (id: string) => void;
  /** Whether the library is shown, or folded to a strip that opens it. @default true */
  open?: boolean;
  /** The search field, to focus it from elsewhere: the end of a chain that opens the library. */
  searchRef?: Ref<HTMLInputElement>;
  /** The devices, by shelf, in the order they are shown. */
  shelves: readonly DeviceBrowserShelf[];
}

/**
 * A library of devices: the shelves down the side, the devices of the open
 * shelf beside them, and a search over every shelf. Enter in the search adds
 * the first device found; Down goes into the list, where Up and Down mark a
 * device and Enter adds it, as do a double-click and the Add button. Drag a
 * device to drop it where it goes on a `DeviceChain`. It keeps what is
 * searched and marked, and nothing else: what a pick does is the host's.
 */
function DeviceBrowser({
  className,
  onOpenChange,
  onPick,
  open = true,
  searchRef,
  shelves,
  ...props
}: DeviceBrowserProps) {
  const [shelf, setShelf] = useState(0);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listId = useId();

  const searching = query.trim() !== "";
  const listed = searching
    ? shelves
        .flatMap((entry) => entry.items)
        .map((candidate) => ({
          candidate,
          score: rank(candidate, query.trim().toLowerCase()),
        }))
        .filter(({ score }) => score !== -1)
        .sort((a, b) => a.score - b.score)
        .map(({ candidate }) => candidate)
    : (shelves[shelf]?.items ?? []);
  const marked = Math.min(cursor, listed.length - 1);
  const item = listed[marked];

  /** Marks the device at `index` and moves the focus to it. */
  const markAt = useCallback(
    (index: number) => {
      setCursor(index);
      document.getElementById(`${listId}-${index}`)?.focus();
    },
    [listId]
  );
  const pick = useCallback(() => {
    if (item) {
      onPick(item.id);
    }
  }, [item, onPick]);
  const search = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setCursor(0);
  }, []);
  const clear = useCallback(() => {
    setQuery("");
    setCursor(0);
  }, []);
  const handleSearchKey = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" && item) {
        event.preventDefault();
        markAt(marked);
      } else if (event.key === "Enter" && item) {
        event.preventDefault();
        onPick(item.id);
      } else if (event.key === "Escape" && query) {
        event.preventDefault();
        clear();
      }
    },
    [clear, item, markAt, marked, onPick, query]
  );
  const handleOptionKey = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const index = Number(event.currentTarget.dataset.index);
      const last = listed.length - 1;
      const to = {
        ArrowDown: Math.min(last, index + 1),
        ArrowUp: Math.max(0, index - 1),
        End: last,
        Home: 0,
      }[event.key];
      if (to !== undefined) {
        event.preventDefault();
        markAt(to);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onPick(listed[index].id);
      }
    },
    [listed, markAt, onPick]
  );
  const openShelf = useCallback((event: { currentTarget: HTMLElement }) => {
    setShelf(Number(event.currentTarget.dataset.shelf));
    setQuery("");
    setCursor(0);
  }, []);
  const mark = useCallback((event: { currentTarget: HTMLElement }) => {
    setCursor(Number(event.currentTarget.dataset.index));
  }, []);
  const pickThis = useCallback(
    (event: { currentTarget: HTMLElement }) => {
      const id = event.currentTarget.dataset.device;
      if (id) {
        onPick(id);
      }
    },
    [onPick]
  );
  const carry = useCallback((event: DragEvent<HTMLElement>) => {
    event.dataTransfer.setData(
      DEVICE_DRAG_TYPE,
      event.currentTarget.dataset.device ?? ""
    );
    event.dataTransfer.effectAllowed = "copy";
  }, []);
  const fold = useCallback(() => onOpenChange?.(false), [onOpenChange]);
  const unfold = useCallback(() => onOpenChange?.(true), [onOpenChange]);

  if (!open) {
    return (
      <button
        aria-expanded={false}
        aria-label="Open the library"
        className={cn(
          "flex w-8 shrink-0 flex-col items-center gap-2 border-e bg-muted/40 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          className
        )}
        data-folded=""
        data-slot="device-browser"
        onClick={unfold}
        type="button"
      >
        <IconPlaceholder
          aria-hidden="true"
          hugeicons="ArrowRight01Icon"
          lucide="ChevronRightIcon"
          phosphor="CaretRightIcon"
          remixicon="RiArrowRightSLine"
          tabler="IconChevronRight"
        />
        <span className="rotate-180 font-medium text-xs [writing-mode:vertical-rl]">
          Library
        </span>
      </button>
    );
  }

  return (
    <section
      aria-label="Library"
      className={cn(
        "flex min-h-0 w-72 shrink-0 flex-col border-e bg-card",
        className
      )}
      data-slot="device-browser"
      {...props}
    >
      <div className="flex shrink-0 items-center gap-1 border-b bg-muted/40 p-1 ps-2.5">
        <span className="flex-1 font-medium text-xs">Library</span>
        {onOpenChange ? (
          <Button
            aria-expanded
            aria-label="Fold the library"
            onClick={fold}
            size="icon-xs"
            variant="ghost"
          >
            <IconPlaceholder
              aria-hidden="true"
              hugeicons="ArrowLeft01Icon"
              lucide="ChevronLeftIcon"
              phosphor="CaretLeftIcon"
              remixicon="RiArrowLeftSLine"
              tabler="IconChevronLeft"
            />
          </Button>
        ) : null}
      </div>
      <div className="shrink-0 border-b p-1.5">
        <InputGroup className="h-7">
          <InputGroupAddon>
            <IconPlaceholder
              aria-hidden="true"
              hugeicons="Search01Icon"
              lucide="SearchIcon"
              phosphor="MagnifyingGlassIcon"
              remixicon="RiSearchLine"
              tabler="IconSearch"
            />
          </InputGroupAddon>
          <InputGroupInput
            aria-controls={listId}
            aria-label="Search the devices"
            onChange={search}
            onKeyDown={handleSearchKey}
            placeholder="Search"
            ref={searchRef}
            type="search"
            value={query}
          />
        </InputGroup>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          aria-label="Shelves"
          className="flex w-28 shrink-0 flex-col gap-px overflow-y-auto border-e bg-muted/30 py-1"
          role="group"
        >
          {shelves.map((entry, index) => (
            <button
              aria-pressed={!searching && index === shelf}
              className="border-transparent border-s-2 px-2 py-1 text-start text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground"
              data-shelf={index}
              key={entry.label}
              onClick={openShelf}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {searching && listed.length === 0 ? (
            <div className="flex flex-col items-start gap-1 p-2 text-muted-foreground text-xs">
              <span>No device matches "{query.trim()}".</span>
              <Button onClick={clear} size="xs" variant="link">
                Clear the search
              </Button>
            </div>
          ) : null}
          <div
            aria-label={searching ? "Devices found" : shelves[shelf]?.label}
            className="min-h-0 flex-1 overflow-y-auto py-0.5"
            id={listId}
            role="listbox"
          >
            {listed.map((entry, index) => (
              <div
                aria-selected={index === marked}
                className="flex cursor-default flex-col gap-0.5 px-2 py-1.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-selected:bg-primary/10"
                data-device={entry.id}
                data-index={index}
                draggable
                id={`${listId}-${index}`}
                key={entry.id}
                onClick={mark}
                onDoubleClick={pickThis}
                onDragStart={carry}
                onKeyDown={handleOptionKey}
                role="option"
                tabIndex={index === marked ? 0 : -1}
              >
                <span className="text-xs">{entry.name}</span>
                {entry.description ? (
                  <span className="line-clamp-2 text-[11px] text-muted-foreground leading-snug">
                    {entry.description}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="shrink-0 border-t p-1.5">
            <Button
              className="w-full"
              disabled={!item}
              onClick={pick}
              size="sm"
              variant="outline"
            >
              {item ? `Add ${item.name}` : "Add"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export { DeviceBrowser };
