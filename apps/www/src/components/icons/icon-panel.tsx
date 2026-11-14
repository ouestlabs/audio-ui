import {
  glyphs,
  type IconEntry,
  type IconWeight,
  toSvg,
  WEIGHTS,
} from "@audio-ui/icons";
import { icons } from "@audio-ui/icons/react";
import * as React from "react";
import { ICON_SIZES, useIcons } from "@/components/icons/icons-context";
import { Button } from "@/components/ui/button";
import { useFramework } from "@/hooks/use-framework";
import { cn } from "@/lib/utils";

const WEIGHT_LABELS: Record<IconWeight, string> = {
  bold: "Bold",
  duotone: "Duotone",
  fill: "Fill",
  regular: "Regular",
};
const COPIED_MS = 1500;

function download(name: string, svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** A choice's name over its control, as the customizer's rows read. */
function Choice({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-2">
      <p className="text-site-muted-foreground text-xs">{label}</p>
      {children}
    </div>
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
  const Icon = icons[entry.name as keyof typeof icons];
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

function SizePick({
  active,
  onPick,
  size,
}: {
  active: boolean;
  onPick: (size: number) => void;
  size: number;
}) {
  const pick = React.useCallback(() => onPick(size), [onPick, size]);
  return (
    <button
      aria-pressed={active}
      className={cn(
        "h-8 flex-1 rounded-md border border-transparent font-medium text-site-muted-foreground text-xs tabular-nums outline-none transition-colors hover:text-site-foreground focus-visible:ring-2 focus-visible:ring-site-foreground/40",
        active && "border-site-border bg-site-background text-site-foreground"
      )}
      onClick={pick}
      type="button"
    >
      {size}
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

/**
 * The customizer of the icons' page: the icon picked, drawn large, the weight
 * and the size every icon is drawn in, its keywords, which search for more like
 * it, and its SVG to copy or save at that weight and size.
 */
export function IconPanel() {
  const { active } = useIcons();
  return active ? <IconDetails entry={active} /> : null;
}

function IconDetails({ entry }: { entry: IconEntry }) {
  const { setQuery, setSize, setWeight, size, weight } = useIcons();
  const [copied, setCopied] = React.useState("");
  const timer = React.useRef<number | undefined>(undefined);
  // The name the reader's code writes: the component in React, the glyph elsewhere.
  const [framework] = useFramework();

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

  const Icon = icons[entry.name as keyof typeof icons];
  const svg = toSvg(glyphs[entry.glyph], { size, weight });
  const name =
    framework && framework !== "react"
      ? `glyphs.${entry.glyph}`
      : `${entry.name}Icon`;
  const copySvg = React.useCallback(() => copy(svg, "SVG copied"), [copy, svg]);
  const copyName = React.useCallback(
    () => copy(name, "Name copied"),
    [copy, name]
  );
  const save = React.useCallback(() => {
    download(`${entry.name.toLowerCase()}.svg`, svg);
    flash("Saved");
  }, [entry.name, flash, svg]);

  return (
    <section
      aria-label={`${entry.name} icon`}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="scroll-fade-y no-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-3 p-2">
          <div className="flex h-32 items-center justify-center rounded-lg bg-site-muted text-site-foreground">
            <Icon className="size-16" weight={weight} />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="truncate font-medium font-site-heading text-base">
              {entry.name}
            </h2>
            <p className="truncate text-site-muted-foreground text-xs">
              {entry.category} · <code>{name}</code>
            </p>
          </div>
        </div>
        <Choice label="Weight">
          <div
            aria-label="Weight"
            className="grid grid-cols-4 gap-1 rounded-lg bg-site-muted p-1"
            role="group"
          >
            {WEIGHTS.map((item) => (
              <WeightPick
                active={item === weight}
                entry={entry}
                key={item}
                onPick={setWeight}
                weight={item}
              />
            ))}
          </div>
        </Choice>
        <Choice label="Size">
          <div
            aria-label="Size"
            className="flex gap-1 rounded-lg bg-site-muted p-1"
            role="group"
          >
            {ICON_SIZES.map((item) => (
              <SizePick
                active={item === size}
                key={item}
                onPick={setSize}
                size={item}
              />
            ))}
          </div>
        </Choice>
        <Choice label="Keywords">
          <div className="flex flex-wrap gap-1">
            {entry.keywords.map((word) => (
              <Keyword key={word} onSearch={setQuery} word={word} />
            ))}
          </div>
        </Choice>
      </div>
      <div className="mt-auto flex shrink-0 flex-col gap-1.5 p-3">
        <Button onClick={copySvg} size="sm">
          {copied === "SVG copied" ? "Copied" : "Copy SVG"}
        </Button>
        <div className="flex gap-1.5">
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
    </section>
  );
}
