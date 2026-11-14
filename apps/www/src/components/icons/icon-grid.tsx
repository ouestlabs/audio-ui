import { categories, type IconEntry, type IconWeight } from "@audio-ui/icons";
import { icons } from "@audio-ui/icons/react";
import * as React from "react";
import { ComponentEmptyState } from "@/components/catalog/card/component-empty-state";
import { useCustomizer } from "@/components/catalog/components-context";
import { useIcons } from "@/components/icons/icons-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ARROWS = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"];

/** The anchor of a category's group on the page, which the sidebar links to. */
export const categoryId = (category: string) => category.toLowerCase();

/** The tile an arrow key moves to: along the reading order for left and right, to the nearest tile of the next row for up and down. */
function nextTile(tiles: HTMLElement[], from: number, key: string) {
  if (key === "ArrowRight") {
    return tiles[from + 1];
  }
  if (key === "ArrowLeft") {
    return tiles[from - 1];
  }
  const origin = tiles[from]?.getBoundingClientRect();
  if (!origin) {
    return;
  }
  const down = key === "ArrowDown";
  const rows = tiles.filter((tile) => {
    const { top } = tile.getBoundingClientRect();
    return down ? top > origin.top + 1 : top < origin.top - 1;
  });
  const tops = rows.map((tile) => tile.getBoundingClientRect().top);
  const nearest = down ? Math.min(...tops) : Math.max(...tops);
  return rows
    .filter((tile) => Math.abs(tile.getBoundingClientRect().top - nearest) < 1)
    .sort(
      (a, b) =>
        Math.abs(a.getBoundingClientRect().left - origin.left) -
        Math.abs(b.getBoundingClientRect().left - origin.left)
    )[0];
}

function Tile({
  entry,
  onOpen,
  onSelect,
  selected,
  size,
  weight,
}: {
  entry: IconEntry;
  onOpen: () => void;
  onSelect: (name: string) => void;
  selected: boolean;
  size: number;
  weight: IconWeight;
}) {
  const select = React.useCallback(
    () => onSelect(entry.name),
    [entry.name, onSelect]
  );
  // A click shows the icon in the panel; the arrow keys only move the focus.
  const open = React.useCallback(() => {
    select();
    onOpen();
  }, [onOpen, select]);
  const Icon = icons[entry.name as keyof typeof icons];
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex h-24 flex-col items-center justify-center gap-2.5 rounded-lg border border-transparent text-site-muted-foreground outline-none transition-colors hover:bg-site-muted hover:text-site-foreground focus-visible:ring-2 focus-visible:ring-site-foreground/40",
        selected &&
          "border-site-border bg-site-muted text-site-foreground hover:bg-site-muted"
      )}
      data-icon-tile=""
      onClick={open}
      onFocus={select}
      tabIndex={selected ? 0 : -1}
      type="button"
    >
      <Icon size={size} weight={weight} />
      <span className="max-w-full truncate px-1 text-xs">{entry.name}</span>
    </button>
  );
}

/** The icons the search shows, by category, drawn in the weight and the size of the panel: a click shows one in the panel. */
export function IconGrid() {
  const { active, query, setQuery, setSelected, size, visible, weight } =
    useIcons();
  const { setCustomizerOpen } = useCustomizer();
  const openPanel = React.useCallback(
    () => setCustomizerOpen(true),
    [setCustomizerOpen]
  );
  const clear = React.useCallback(() => setQuery(""), [setQuery]);
  const sections = categories
    .map((category) => ({
      category,
      entries: visible.filter((entry) => entry.category === category),
    }))
    .filter((section) => section.entries.length > 0);

  // The arrow keys move among the tiles; the panel follows the focus.
  const grid = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const element = grid.current;
    if (!element) {
      return;
    }
    const arrows = (event: KeyboardEvent) => {
      if (!ARROWS.includes(event.key)) {
        return;
      }
      const tiles = [
        ...element.querySelectorAll<HTMLElement>("[data-icon-tile]"),
      ];
      const from = tiles.indexOf(document.activeElement as HTMLElement);
      if (from < 0) {
        return;
      }
      event.preventDefault();
      nextTile(tiles, from, event.key)?.focus();
    };
    element.addEventListener("keydown", arrows);
    return () => element.removeEventListener("keydown", arrows);
  }, []);

  if (visible.length === 0) {
    return (
      <ComponentEmptyState
        className="border"
        description={`No icon matches “${query}”. Try a word like “filter” or “wave”.`}
        title="No icons found"
      >
        <Button onClick={clear} size="sm" variant="outline">
          Clear the search
        </Button>
      </ComponentEmptyState>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-6" ref={grid}>
      {sections.map((section) => (
        <section
          aria-labelledby={`${categoryId(section.category)}-heading`}
          className="flex scroll-mt-4 flex-col gap-1"
          id={categoryId(section.category)}
          key={section.category}
        >
          <h2
            className="px-1 font-medium text-site-muted-foreground text-xs"
            id={`${categoryId(section.category)}-heading`}
          >
            {section.category}
            <span className="ps-1.5 tabular-nums opacity-60">
              {section.entries.length}
            </span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1">
            {section.entries.map((entry) => (
              <Tile
                entry={entry}
                key={entry.name}
                onOpen={openPanel}
                onSelect={setSelected}
                selected={entry.name === active?.name}
                size={size}
                weight={weight}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
