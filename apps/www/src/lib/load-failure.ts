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
 * Reloads the page, which fetches the current deploy, and returns true. A page
 * that already asked also gets true, its reload is on the way. A page that came
 * back from a reload in the last minute gets false, so a failure the reload
 * does not fix shows the error page instead of looping.
 */
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY));
    if (last >= performance.timeOrigin) {
      return true;
    }
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

/**
 * Reloads the page once when Vite fails to load a chunk. The import still
 * throws: cancelling the event would make it resolve to nothing, and the code
 * waiting for it would fail on `undefined`, a bug report for a reload that works.
 */
export function watchPreloadErrors() {
  const onPreloadError = () => {
    reloadOnce();
  };
  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}
