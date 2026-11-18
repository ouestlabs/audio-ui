import { baseAddressOf } from "@/lib/docs/content/base-paths";
import { frameworkAddressOf } from "@/lib/docs/content/framework-paths";

type Search = { base?: unknown; framework?: unknown };

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
  return {
    ...search,
    ...(addFramework ? { framework: addFramework } : {}),
    ...(addBase ? { base: addBase } : {}),
  };
}
