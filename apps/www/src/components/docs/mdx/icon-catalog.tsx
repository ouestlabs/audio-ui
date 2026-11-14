import { catalog, categories } from "@audio-ui/icons";
import { icons } from "@audio-ui/icons/react";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/** One glyph of each category, the first the catalog lists. */
const SAMPLES = categories.flatMap((category) => {
  const entry = catalog.find((each) => each.category === category);
  return entry ? [entry] : [];
});

/**
 * The catalog on a docs page: a glyph of each category and the way to the
 * icons' page, where they are searched and copied. As markdown, the tag is the
 * table of every icon (`expandIconCatalog`).
 */
export function IconCatalog() {
  return (
    <div className="not-typeset my-6 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3">
        <div aria-hidden="true" className="flex flex-wrap gap-3">
          {SAMPLES.map((entry) => {
            const Icon = icons[entry.name as keyof typeof icons];
            return (
              <Icon
                className="size-5 text-site-muted-foreground"
                key={entry.name}
              />
            );
          })}
        </div>
        <p className="text-site-muted-foreground text-sm">
          {catalog.length} icons in {categories.length} categories, to search,
          then copy or save as SVG.
        </p>
      </div>
      <Button
        className="shrink-0"
        nativeButton={false}
        render={
          <Link to="/icons">
            Browse the icons
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        }
        variant="outline"
      />
    </div>
  );
}
