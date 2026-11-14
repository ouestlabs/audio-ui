import { catalog } from "@audio-ui/icons";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { useIcons } from "@/components/icons/icons-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** The search of the icons' page, in the bar of the frame as the catalog's is: the grid follows each key. The slash key brings it into focus. */
export function IconSearch() {
  const { query, setQuery, visible } = useIcons();
  const input = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(target?.tagName ?? "")
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", focus);
    return () => window.removeEventListener("keydown", focus);
  }, []);

  const change = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setQuery(event.target.value),
    [setQuery]
  );
  const clear = React.useCallback(() => {
    setQuery("");
    input.current?.focus();
  }, [setQuery]);
  const escape = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Escape") {
        return;
      }
      if (query) {
        setQuery("");
      } else {
        input.current?.blur();
      }
    },
    [query, setQuery]
  );
  const found = `${visible.length} ${visible.length === 1 ? "icon" : "icons"}`;

  return (
    <div className="group relative flex flex-1 items-center gap-2">
      <MagnifyingGlassIcon
        aria-hidden="true"
        className="mx-1 size-4 shrink-0 text-site-muted-foreground transition-colors group-focus-within:text-site-foreground"
        weight="duotone"
      />
      <input
        aria-label="Search the icons"
        className={cn(
          "h-8 w-full border-0 bg-transparent py-1 text-sm placeholder:text-site-muted-foreground focus-visible:outline-none",
          query ? "pr-32" : "pr-0"
        )}
        onChange={change}
        onKeyDown={escape}
        placeholder={`Search ${catalog.length} icons…`}
        ref={input}
        type="text"
        value={query}
      />
      <span aria-live="polite" className="sr-only" role="status">
        {query ? `${found} for ${query}` : ""}
      </span>
      {query ? (
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5">
          <span className="hidden font-medium text-site-muted-foreground text-xs tabular-nums sm:inline">
            Found {found}
          </span>
          <Separator className="shrink-0" orientation="vertical" />
          <Button
            className="opacity-60 hover:bg-transparent hover:opacity-100"
            onClick={clear}
            size="icon"
            type="button"
            variant="outline"
          >
            <XIcon />
            <span className="sr-only">Clear the search</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
