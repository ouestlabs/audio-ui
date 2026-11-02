import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { render } from "@testing-library/react";
import posthog from "posthog-js";
import { ErrorPage } from "@/components/site/pages/error-page";
import {
  isLoadFailure,
  reloadOnce,
  watchPreloadErrors,
} from "@/lib/load-failure";

describe("isLoadFailure", () => {
  test("knows each browser's words for code or data that did not load", () => {
    for (const message of [
      "Load failed",
      "Failed to fetch",
      "Failed to fetch dynamically imported module: https://www.audio-ui.dev/assets/phaser-x1.js",
      "NetworkError when attempting to fetch resource.",
      "error loading dynamically imported module: https://www.audio-ui.dev/assets/phaser-x1.js",
      "Importing a module script failed.",
      "Unable to preload CSS for /assets/phaser-x1.css",
    ]) {
      expect(isLoadFailure(new TypeError(message))).toBe(true);
    }
  });

  test("leaves a bug in the page alone", () => {
    expect(
      isLoadFailure(new TypeError("Cannot read properties of undefined"))
    ).toBe(false);
    expect(isLoadFailure("Load failed")).toBe(false);
  });
});

describe("reloadOnce", () => {
  const reset = () => undefined;
  let reload: ReturnType<typeof spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    reload = spyOn(window.location, "reload").mockImplementation(() => {
      // The test page stays where it is.
    });
  });

  afterEach(() => {
    reload.mockRestore();
  });

  test("a page that already asked for the reload just waits for it", () => {
    expect(reloadOnce()).toBe(true);
    expect(reloadOnce()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test("a page back from a reload lets a failure it did not fix through", () => {
    sessionStorage.setItem(
      "audio-ui:load-failure-reload",
      String(performance.timeOrigin - 1)
    );
    expect(reloadOnce()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  test("reloads again a minute later, for the next deploy", () => {
    sessionStorage.setItem(
      "audio-ui:load-failure-reload",
      String(performance.timeOrigin - 61_000)
    );
    expect(reloadOnce()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test("the error page reloads on a load failure and reports the rest", () => {
    const capture = spyOn(posthog, "captureException").mockImplementation(
      () => undefined
    );
    render(<ErrorPage error={new TypeError("Load failed")} reset={reset} />);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();

    const bug = new TypeError("Cannot read properties of undefined");
    render(<ErrorPage error={bug} reset={reset} />);
    expect(capture).toHaveBeenCalledWith(bug);
    capture.mockRestore();
  });

  test("a chunk that fails reloads, and nothing is reported while it does", () => {
    const capture = spyOn(posthog, "captureException").mockImplementation(
      () => undefined
    );
    const stop = watchPreloadErrors();
    const event = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(event);
    stop();
    expect(reload).toHaveBeenCalledTimes(1);
    // Left uncancelled, the import rejects with the browser's own words instead
    // of resolving to undefined, so the error page knows it for what it is.
    expect(event.defaultPrevented).toBe(false);

    render(
      <ErrorPage
        error={
          new TypeError(
            "Failed to fetch dynamically imported module: https://www.audio-ui.dev/assets/phaser-x1.js"
          )
        }
        reset={reset}
      />
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
    capture.mockRestore();
  });
});
