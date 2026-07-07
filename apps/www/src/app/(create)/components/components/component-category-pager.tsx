import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import {
  getCategoryInfo,
  getCategoryNames,
  getComponentCountByCategory,
} from "@/lib/registry";
import { cn, normalizeSlug } from "@/lib/utils";

interface ComponentCategoryPagerProps {
  currentCategory: string;
}

const linkClass =
  "border-site-border bg-site-background hover:bg-site-muted/50 focus-visible:ring-site-ring text-foreground group flex min-h-14 w-full min-w-0 items-center gap-3 site-rounded-xl border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:min-h-16 sm:px-5";

function formatAdjacentCategoryTitle(categorySlug: string) {
  const info = getCategoryInfo(categorySlug);
  if (!info) {
    return "";
  }
  const count = getComponentCountByCategory(categorySlug);
  return `${count} Shadcn ${info.label} components`;
}

export function ComponentCategoryPager({
  currentCategory,
}: ComponentCategoryPagerProps) {
  const normalized = normalizeSlug(currentCategory);
  const names = getCategoryNames();
  const index = names.indexOf(normalized);

  if (index === -1) {
    return null;
  }

  const prevName = index > 0 ? names[index - 1] : null;
  const nextName = index < names.length - 1 ? names[index + 1] : null;

  if (!(prevName || nextName)) {
    return null;
  }

  return (
    <nav
      aria-label="Adjacent pattern categories"
      className="w-full px-6 pt-2 pb-10 sm:px-8 xl:px-10"
    >
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="min-w-0">
          {prevName ? (
            <Link
              className={cn(linkClass, "justify-between")}
              href={`/components/${normalizeSlug(prevName)}`}
            >
              <CaretLeftIcon
                aria-hidden
                className="size-4 shrink-0 text-site-muted-foreground transition-colors group-hover:text-foreground"
              />
              <span className="min-w-0 flex-1 text-right">
                <span className="block font-medium text-site-muted-foreground text-xs">
                  Previous
                </span>
                <span className="mt-0.5 block truncate font-medium text-sm">
                  {formatAdjacentCategoryTitle(prevName)}
                </span>
              </span>
            </Link>
          ) : null}
        </div>

        <div className="min-w-0 sm:flex sm:justify-end">
          {nextName ? (
            <Link
              className={cn(linkClass, "justify-between sm:w-full")}
              href={`/components/${normalizeSlug(nextName)}`}
            >
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-medium text-site-muted-foreground text-xs">
                  Next
                </span>
                <span className="mt-0.5 block truncate font-medium text-sm">
                  {formatAdjacentCategoryTitle(nextName)}
                </span>
              </span>
              <CaretRightIcon
                aria-hidden
                className="size-4 shrink-0 text-site-muted-foreground transition-colors group-hover:text-foreground"
              />
            </Link>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
