"use client";

import type { ReactNode } from "react";
import { useFramework } from "@/hooks/use-framework";

/**
 * Content for some frameworks only, as `only` lists them by id ("react",
 * "vue svelte web"): shown when the reader's framework is one of them, React
 * standing in for no framework chosen, so a page reads as written for its
 * reader. A heading stays outside it, for the table of contents. The
 * markdown of the page keeps every block, each under its frameworks' names.
 */
export function ForFrameworks({
  children,
  only,
}: {
  children: ReactNode;
  only: string;
}) {
  const [framework] = useFramework();
  return only.split(" ").includes(framework ?? "react") ? children : null;
}
