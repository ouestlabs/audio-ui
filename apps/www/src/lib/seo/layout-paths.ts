/**
 * The site's pathless layout route, `/_site`, gives the router ids such as
 * `/_site/docs` that read like addresses. Crawlers find them in the router's
 * state, in every page's scripts, and ask for them: each is answered with a
 * permanent redirect to the address it stands for.
 */
const LAYOUT_PREFIX = /^\/_site(?=\/|$)/;
const TRAILING_SLASHES = /\/+$/;

/** The address a layout route id stands for, without the trailing slash the site never uses; nothing for any other path. */
export function addressOfLayoutPath(pathname: string) {
  if (!LAYOUT_PREFIX.test(pathname)) {
    return;
  }
  return (
    pathname.replace(LAYOUT_PREFIX, "").replace(TRAILING_SLASHES, "") || "/"
  );
}
