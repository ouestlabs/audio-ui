import { catalog, type IconEntry, type IconWeight } from "@audio-ui/icons";
import { createContext, use, useMemo, useState } from "react";

/** The sizes an icon is drawn and saved at, in pixels. */
export const ICON_SIZES = [16, 24, 32] as const;

const WHITESPACE = /\s+/;

/** Every word of the query is in the name, the category or a keyword. */
function matches(entry: IconEntry, query: string) {
  const words = query.toLowerCase().split(WHITESPACE).filter(Boolean);
  const text = [entry.name, entry.category, ...entry.keywords]
    .join(" ")
    .toLowerCase();
  return words.every((word) => text.includes(word));
}

interface IconsContextValue {
  /** The icon in the panel: the one picked when the search shows it, else the first shown. */
  active: IconEntry | undefined;
  query: string;
  setQuery: (query: string) => void;
  setSelected: (name: string) => void;
  setSize: (size: number) => void;
  setWeight: (weight: IconWeight) => void;
  size: number;
  /** The icons the search shows, in the catalog's order. */
  visible: IconEntry[];
  weight: IconWeight;
}

const IconsContext = createContext<IconsContextValue | null>(null);

/**
 * What the icons' page is showing, shared by the parts of the frame around it:
 * the search in the bar, the grid, and the panel with the icon picked, its
 * weight and its size.
 */
export function IconsProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(catalog[0]?.name ?? "");
  const [size, setSize] = useState<number>(24);
  const [weight, setWeight] = useState<IconWeight>("regular");
  const visible = useMemo(
    () => catalog.filter((entry) => matches(entry, query)),
    [query]
  );
  const active =
    visible.find((entry) => entry.name === selected) ??
    visible[0] ??
    catalog.find((entry) => entry.name === selected);
  const value = useMemo(
    () => ({
      active,
      query,
      setQuery,
      setSelected,
      setSize,
      setWeight,
      size,
      visible,
      weight,
    }),
    [active, query, size, visible, weight]
  );
  return <IconsContext value={value}>{children}</IconsContext>;
}

export function useIcons() {
  const context = use(IconsContext);
  if (!context) {
    throw new Error("useIcons must be used within an IconsProvider");
  }
  return context;
}
