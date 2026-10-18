"use client";

import {
  catalog,
  categories,
  glyphs,
  type IconEntry,
  type IconWeight,
  toSvg,
  WEIGHTS,
} from "@audio-ui/icons";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SIZES = [16, 24, 32] as const;
const WEIGHT_LABELS: Record<IconWeight, string> = {
  bold: "Bold",
  duotone: "Duotone",
  fill: "Fill",
  regular: "Regular",
};
const ARROWS = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"];
const COPIED_MS = 1500;
const WHITESPACE = /\s+/;

/** Every word of the query is in the name, the category or a keyword. */
function matches(entry: IconEntry, query: string) {
  const words = query.toLowerCase().split(WHITESPACE).filter(Boolean);
  const text = [entry.name, entry.category, ...entry.keywords]
    .join(" ")
    .toLowerCase();
  return words.every((word) => text.includes(word));
}

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

function download(name: string, svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function SegmentedButton<T extends number | string>({
  active,
  label,
  onPick,
  value,
}: {
  active: boolean;
  label: string;
  onPick: (value: T) => void;
  value: T;
}) {
  const pick = React.useCallback(() => onPick(value), [onPick, value]);
  return (
    <button
      aria-pressed={active}
      className={cn(
        "h-7 rounded-md px-2.5 font-medium text-site-muted-foreground text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-site-foreground/40",
        active
          ? "bg-site-background text-site-foreground shadow-xs"
          : "hover:text-site-foreground"
      )}
      onClick={pick}
      type="button"
    >
      {label}
    </button>
  );
}

function Segmented<T extends number | string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  return (
    <div
      aria-label={label}
      className="flex gap-0.5 rounded-lg bg-site-muted p-0.5"
      role="group"
    >
      {options.map((option) => (
        <SegmentedButton
          active={option.value === value}
          key={option.value}
          label={option.label}
          onPick={onChange}
          value={option.value}
        />
      ))}
    </div>
  );
}

function Tile({
  entry,
  onSelect,
  selected,
  size,
  weight,
}: {
  entry: IconEntry;
  onSelect: (name: string) => void;
  selected: boolean;
  size: number;
  weight: IconWeight;
}) {
  const select = React.useCallback(
    () => onSelect(entry.name),
    [entry.name, onSelect]
  );
  const { Icon } = entry;
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex h-24 flex-col items-center justify-center gap-2.5 rounded-lg border border-transparent text-site-muted-foreground outline-none transition-colors hover:bg-site-muted hover:text-site-foreground focus-visible:ring-2 focus-visible:ring-site-foreground/40",
        selected &&
          "border-site-border bg-site-muted text-site-foreground hover:bg-site-muted"
      )}
      data-icon-tile=""
      onClick={select}
      onFocus={select}
      tabIndex={selected ? 0 : -1}
      type="button"
    >
      <Icon size={size} weight={weight} />
      <span className="max-w-full truncate px-1 text-xs">{entry.name}</span>
    </button>
  );
}

function WeightPick({
  active,
  entry,
  onPick,
  weight,
}: {
  active: boolean;
  entry: IconEntry;
  onPick: (weight: IconWeight) => void;
  weight: IconWeight;
}) {
  const pick = React.useCallback(() => onPick(weight), [onPick, weight]);
  const { Icon } = entry;
  return (
    <button
      aria-label={`${WEIGHT_LABELS[weight]} weight`}
      aria-pressed={active}
      className={cn(
        "flex h-11 flex-1 items-center justify-center rounded-md border border-transparent text-site-muted-foreground outline-none transition-colors hover:text-site-foreground focus-visible:ring-2 focus-visible:ring-site-foreground/40",
        active && "border-site-border bg-site-background text-site-foreground"
      )}
      onClick={pick}
      title={WEIGHT_LABELS[weight]}
      type="button"
    >
      <Icon size={20} weight={weight} />
    </button>
  );
}

function Keyword({
  onSearch,
  word,
}: {
  onSearch: (word: string) => void;
  word: string;
}) {
  const search = React.useCallback(() => onSearch(word), [onSearch, word]);
  return (
    <button
      className="rounded-md bg-site-muted px-1.5 py-0.5 text-site-muted-foreground text-xs outline-none transition-colors hover:text-site-foreground focus-visible:ring-2 focus-visible:ring-site-foreground/40"
      onClick={search}
      type="button"
    >
      {word}
    </button>
  );
}

function Inspector({
  entry,
  onSearch,
  onWeight,
  weight,
}: {
  entry: IconEntry;
  onSearch: (word: string) => void;
  onWeight: (weight: IconWeight) => void;
  weight: IconWeight;
}) {
  const [copied, setCopied] = React.useState("");
  const timer = React.useRef<number | undefined>(undefined);
  const { Icon } = entry;
  const svg = toSvg(glyphs[entry.glyph], { weight });

  const flash = React.useCallback((what: string) => {
    setCopied(what);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(""), COPIED_MS);
  }, []);
  const copy = React.useCallback(
    async (text: string, what: string) => {
      try {
        await navigator.clipboard.writeText(text);
        flash(what);
      } catch {
        flash("Copy failed");
      }
    },
    [flash]
  );
  const copySvg = React.useCallback(() => copy(svg, "SVG copied"), [copy, svg]);
  const copyName = React.useCallback(
    () => copy(`${entry.name}Icon`, "Name copied"),
    [copy, entry.name]
  );
  const save = React.useCallback(() => {
    download(`${entry.name.toLowerCase()}.svg`, svg);
    flash("Saved");
  }, [entry.name, flash, svg]);

  return (
    <aside
      aria-label={`${entry.name} icon`}
      className="sticky bottom-3 z-10 order-last flex flex-col gap-3 rounded-xl border border-site-border bg-site-background p-3 shadow-lg lg:top-24 lg:bottom-auto lg:shadow-none"
    >
      <div className="flex items-center gap-3 lg:flex-col lg:items-stretch">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-site-muted text-site-foreground lg:h-32 lg:w-full">
          <Icon className="size-8 lg:size-16" weight={weight} />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate font-medium font-site-heading text-base">
            {entry.name}
          </p>
          <p className="truncate text-site-muted-foreground text-xs">
            {entry.category} · <code>{entry.name}Icon</code>
          </p>
        </div>
      </div>
      <div className="hidden grid-cols-4 gap-1 rounded-lg bg-site-muted p-1 lg:grid">
        {WEIGHTS.map((item) => (
          <WeightPick
            active={item === weight}
            entry={entry}
            key={item}
            onPick={onWeight}
            weight={item}
          />
        ))}
      </div>
      <div className="hidden flex-wrap gap-1 lg:flex">
        {entry.keywords.map((word) => (
          <Keyword key={word} onSearch={onSearch} word={word} />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Button className="hidden lg:inline-flex" onClick={copySvg} size="sm">
          {copied === "SVG copied" ? "Copied" : "Copy SVG"}
        </Button>
        <div className="flex gap-1.5">
          <Button className="flex-1 lg:hidden" onClick={copySvg} size="sm">
            {copied === "SVG copied" ? "Copied" : "Copy SVG"}
          </Button>
          <Button className="flex-1" onClick={save} size="sm" variant="outline">
            {copied === "Saved" ? "Saved" : "Download"}
          </Button>
          <Button
            className="flex-1"
            onClick={copyName}
            size="sm"
            variant="outline"
          >
            {copied === "Name copied" ? "Copied" : "Copy name"}
          </Button>
        </div>
        <span aria-live="polite" className="sr-only" role="status">
          {copied}
        </span>
      </div>
    </aside>
  );
}

/** The catalog of the package's icons: search them, pick a weight and a size, then copy or save the SVG of the one in the panel. */
export function IconCatalog({ className }: { className?: string }) {
  const [query, setQuery] = React.useState("");
  const [weight, setWeight] = React.useState<IconWeight>("regular");
  const [size, setSize] = React.useState<number>(24);
  const [selected, setSelected] = React.useState(catalog[0]?.name ?? "");

  const visible = React.useMemo(
    () => catalog.filter((entry) => matches(entry, query)),
    [query]
  );
  const active = visible.find((entry) => entry.name === selected) ?? visible[0];
  const sections = categories
    .map((category) => ({
      category,
      entries: visible.filter((entry) => entry.category === category),
    }))
    .filter((section) => section.entries.length > 0);

  const search = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setQuery(event.target.value),
    []
  );
  const clear = React.useCallback(() => setQuery(""), []);
  const searchBox = React.useRef<HTMLInputElement>(null);
  const searchFor = React.useCallback((word: string) => {
    setQuery(word);
    // The search is where the result is: bring the reader back to it.
    searchBox.current?.focus();
  }, []);
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

  return (
    <div className={cn("not-typeset my-6 flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-site-muted-foreground"
          />
          <Input
            aria-label="Search the icons"
            className="pl-8"
            onChange={search}
            placeholder={`Search ${catalog.length} icons`}
            ref={searchBox}
            type="search"
            value={query}
          />
        </div>
        <span aria-live="polite" className="sr-only" role="status">
          {query
            ? `${visible.length} ${visible.length === 1 ? "icon" : "icons"} for ${query}`
            : `${catalog.length} icons`}
        </span>
        <Segmented
          label="Weight"
          onChange={setWeight}
          options={WEIGHTS.map((item) => ({
            label: WEIGHT_LABELS[item],
            value: item,
          }))}
          value={weight}
        />
        <Segmented
          label="Size"
          onChange={setSize}
          options={SIZES.map((item) => ({ label: `${item}`, value: item }))}
          value={size}
        />
      </div>
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-site-muted-foreground text-sm">
          <p>No icon matches “{query}”.</p>
          <Button onClick={clear} size="sm" variant="outline">
            Clear the search
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_16rem]">
          {active ? (
            <Inspector
              entry={active}
              onSearch={searchFor}
              onWeight={setWeight}
              weight={weight}
            />
          ) : null}
          <div
            className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1"
            ref={grid}
          >
            {sections.map((section) => (
              <section
                aria-label={section.category}
                className="flex flex-col gap-1"
                key={section.category}
              >
                <h2 className="px-1 font-medium text-site-muted-foreground text-xs">
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
        </div>
      )}
    </div>
  );
}
