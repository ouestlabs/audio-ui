"use client";

import type { ReactNode } from "react";
import { useFramework } from "@/hooks/use-framework";

/**
 * Content for some frameworks only, as `only` lists them by id ("react",
 * "vue svelte web"): shown when the reader's framework is one of them, React
 * standing in for no framework chosen, and `any` naming that case alone, so
 * a page reads as written for its reader. A heading in it leaves the table of
 * contents with it. The markdown of the page keeps every block, each under
 * its frameworks' names.
 */
export function ForFrameworks({
  children,
  only,
}: {
  children: ReactNode;
  only: string;
}) {
  const [framework] = useFramework();
  const tokens = only.split(" ");
  // `any` is for no framework chosen, beside React standing in for it.
  const shown =
    tokens.includes(framework ?? "react") ||
    (framework === null && tokens.includes("any"));
  return shown ? children : null;
}
