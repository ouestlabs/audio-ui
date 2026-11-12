import { useMatches } from "@tanstack/react-router";
import type { CustomizerScope } from "@/lib/design-system/customizer-scope";

/**
 * What the customizer changes on the page shown: a docs page says it in its
 * loader's data, read from its MDX; the home and the catalog in their route's
 * static data. Known on the server, so the panel is right on the first paint.
 */
export function useCustomizerScope(): CustomizerScope {
  return useMatches({
    select: (matches) => {
      const page = matches.at(-1);
      const loaded = page?.loaderData as
        | { customizer?: CustomizerScope }
        | undefined;
      return loaded?.customizer ?? page?.staticData.customizer ?? "none";
    },
  });
}
