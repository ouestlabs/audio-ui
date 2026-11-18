/**
 * The base addresses of the component pages: `/docs/components/ui-sdk/knob` is
 * the page of the knob, read for the `ui-sdk` base. The page is the same file
 * under another address, so the router rewrites it to the page's own address
 * with the base in a `?base=`, and back the other way: an address the reader
 * sees never has it. The default base keeps `/docs/components/base/knob`.
 */

/** The bases that have an address of their own for the component pages. */
export const ADDRESSED_BASES = ["ui-sdk"] as const;

const COMPONENT_PAGES = "/docs/components/base/";

const ADDRESS = /^\/docs\/components\/(ui-sdk)\/(.+)$/;

/** The page an address is, and its base: `/docs/components/ui-sdk/knob` is `/docs/components/base/knob` for `ui-sdk`. Null for any other address. */
export function pageOfBaseAddress(
  pathname: string
): { base: string; pathname: string } | null {
  const match = ADDRESS.exec(pathname);
  if (!(match?.[1] && match[2])) {
    return null;
  }
  return { base: match[1], pathname: `${COMPONENT_PAGES}${match[2]}` };
}

/** The address of a component page read for a base, or null when the base has none or the page is not a component's. */
export function baseAddressOf(
  pathname: string,
  base: string | null
): string | null {
  if (
    !(
      base &&
      (ADDRESSED_BASES as readonly string[]).includes(base) &&
      pathname.startsWith(COMPONENT_PAGES)
    )
  ) {
    return null;
  }
  return `/docs/components/${base}/${pathname.slice(COMPONENT_PAGES.length)}`;
}

/** The base addresses to build: each component page of the docs, `pages` being their addresses, for each base that has addresses. */
export function baseAddresses(pages: readonly string[]): string[] {
  return pages.flatMap((page) =>
    ADDRESSED_BASES.flatMap((base) => {
      const address = baseAddressOf(page, base);
      return address ? [address] : [];
    })
  );
}
