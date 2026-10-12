import * as React from "react";

/** What the server formats with: the browser's own language is not known there. */
const SERVER_LOCALE = "en-US";

const subscribe = () => () => undefined;
const getSnapshot = () =>
  typeof navigator === "undefined" ? SERVER_LOCALE : navigator.language;
const getServerSnapshot = () => SERVER_LOCALE;

/**
 * The locale numbers are formatted with: `locale` if one is given, else the
 * browser's language. The server and the first client render agree on one
 * fixed language, so a page rendered on the server hydrates cleanly, and the
 * browser's language takes over right after.
 */
export function useLocale(locale?: Intl.LocalesArgument): Intl.LocalesArgument {
  const detected = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  return locale ?? detected;
}
