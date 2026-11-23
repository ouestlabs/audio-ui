import { addressOf } from "@/lib/docs/content/addresses";
import { baseAddressOf } from "@/lib/docs/content/base-paths";
import { frameworkAddressOf } from "@/lib/docs/content/framework-paths";

type Search = { base?: unknown; framework?: unknown };

const named = (value: unknown) => (typeof value === "string" ? value : null);

/**
 * The search a page is sent to when the reader's framework or base has an
 * address for it and the address does not say so yet, or null when it is as
 * it should be. A redirect keeps what the address already says: one that
 * dropped the other's key sent the page back and forth without end.
 */
export function keptRedirectSearch({
  base,
  framework,
  inSite,
  pathname,
  search,
}: {
  base: string | null;
  framework: string | null;
  /** A link followed in the site: the address of a page loaded whole is the reader's own. */
  inSite: boolean;
  pathname: string;
  search: Search;
}): Search | null {
  const addFramework =
    framework && !search.framework && frameworkAddressOf(pathname, framework)
      ? framework
      : null;
  const addBase =
    inSite && base && !search.base && baseAddressOf(pathname, base)
      ? base
      : null;
  if (!(addFramework || addBase)) {
    return null;
  }
  const next = {
    ...search,
    ...(addFramework ? { framework: addFramework } : {}),
    ...(addBase ? { base: addBase } : {}),
  };
  // The address alone says what a page is read for: a redirect that leaves it as it is would be made again on the next load, as Vue's address reads no base.
  if (
    addressOf(pathname, named(next.framework), named(next.base)) ===
    addressOf(pathname, named(search.framework), named(search.base))
  ) {
    return null;
  }
  return next;
}
