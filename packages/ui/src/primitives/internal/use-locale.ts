import * as React from "react";

/** What the server formats with: the browser's own language is not known there. */
const SERVER_LOCALE = "en-US";

/**
 * A language the formatters accept. Some platforms report a POSIX locale
 * (`en-US@posix`, `C`), which `Intl` refuses: such a language falls back to
 * the server's, instead of throwing during the render.
 */
export function usableLocale(language: string): string {
  try {
    Intl.getCanonicalLocales(language);
    return language;
  } catch {
    return SERVER_LOCALE;
  }
}

const subscribe = () => () => undefined;
const getSnapshot = () =>
  typeof navigator === "undefined"
    ? SERVER_LOCALE
    : usableLocale(navigator.language);
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
