import type { ErrorComponentProps } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useEffect } from "react";

/** What a page that failed to render shows. The error goes to PostHog, which only the router's boundary would otherwise keep from it. */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-site-background p-6 font-site-sans text-site-foreground">
      <h1 className="font-semibold text-2xl">Something went wrong</h1>
      <p className="text-site-muted-foreground">
        The page could not be shown. Try again, and if it persists, tell us.
      </p>
      <button
        className="site-rounded-md border border-site-border px-4 py-2 text-sm hover:bg-site-muted"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
