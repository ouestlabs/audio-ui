/**
 * The messages browsers give a request for the page's code or data that never
 * arrived: a chunk a newer deploy replaced, or a dropped connection. Safari
 * says "Load failed", Chrome "Failed to fetch", Firefox "NetworkError", and
 * Vite "Unable to preload CSS".
 */
const LOAD_FAILURE =
  /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS)/;

const RELOAD_KEY = "audio-ui:load-failure-reload";
const RELOAD_WINDOW_MS = 60_000;

/** Whether an error is the network or a stale deploy rather than a bug in the page. */
export function isLoadFailure(error: unknown) {
  return error instanceof Error && LOAD_FAILURE.test(error.message);
}

/**
 * Reloads the page, which fetches the current deploy, and returns true; or
 * returns false when it already did so in the last minute, so a failure the
 * reload does not fix shows the error page instead of looping.
 */
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY));
    if (Date.now() - last < RELOAD_WINDOW_MS) {
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Reloads the page once when Vite fails to load a chunk, instead of letting the import throw. */
export function watchPreloadErrors() {
  const onPreloadError = (event: Event) => {
    if (reloadOnce()) {
      event.preventDefault();
    }
  };
  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}
