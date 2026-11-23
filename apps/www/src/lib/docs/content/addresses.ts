import {
  baseAddressOf,
  pageOfBaseAddress,
} from "@/lib/docs/content/base-paths";
import {
  frameworkAddressOf,
  pageOfFrameworkAddress,
  under,
} from "@/lib/docs/content/framework-paths";

/**
 * A page of the docs says the framework and the base it is read for in its
 * path, never in its query. Inside the router it is the page's own address
 * with `framework` and `base` in a search only the router sees. The pages are
 * prerendered by path, so a query that named either would read a page for
 * another framework than the one its HTML was drawn for.
 */
const ADDRESS_PARAMS = ["framework", "base"] as const;

/**
 * The address of a page read for a framework and a base. React reads both
 * (`/docs/react/components/ui-sdk/knob`). Another framework reads no base,
 * since only React's components have one, so its own address wins
 * (`/docs/svelte/components/base/knob`).
 */
export function addressOf(
  pathname: string,
  framework: string | null,
  base: string | null
): string {
  const baseAddress = baseAddressOf(pathname, base);
  const both = baseAddress ? frameworkAddressOf(baseAddress, framework) : null;
  return (
    both ?? frameworkAddressOf(pathname, framework) ?? baseAddress ?? pathname
  );
}

/** The router's location of an address the reader sees: a query for the framework or the base is dropped, and the path says them. */
export function pageOfAddress(url: URL): URL {
  if (!under(url.pathname, "/docs")) {
    return url;
  }
  for (const name of ADDRESS_PARAMS) {
    url.searchParams.delete(name);
  }
  const page = pageOfFrameworkAddress(url.pathname);
  if (page) {
    url.pathname = page.pathname;
    url.searchParams.set("framework", page.framework);
  }
  const base = pageOfBaseAddress(url.pathname);
  if (base) {
    url.pathname = base.pathname;
    url.searchParams.set("base", base.base);
  }
  return url;
}

/** The address the reader sees for a router's location: the framework and the base go in the path, and never stay in the query. */
export function addressOfPage(url: URL): URL {
  if (!under(url.pathname, "/docs")) {
    return url;
  }
  const framework = url.searchParams.get("framework");
  const base = url.searchParams.get("base");
  for (const name of ADDRESS_PARAMS) {
    url.searchParams.delete(name);
  }
  url.pathname = addressOf(url.pathname, framework, base);
  return url;
}
