import type { Metadata } from "next";
import { searchCatalog } from "@/lib/registry";
import { buildPageMetadata } from "@/lib/seo";

import { ComponentShowcase } from "./components/component-showcase";

const SHOWCASE_NAMES = [
  "block-player-widget",
  "block-pocket-synth",
  "block-wave-shaper",
  "block-player",
] as const;

const SHOWCASE_FULL_WIDTH = new Set(["block-player", "block-player-widget"]);

function getShowcaseCatalogItems() {
  const catalog = searchCatalog("");
  const byName = new Map(catalog.map((item) => [item.name, item]));

  return SHOWCASE_NAMES.map((name) => byName.get(name))
    .filter((item): item is NonNullable<typeof item> => item !== undefined)
    .map((item) => ({
      ...item,
      meta: SHOWCASE_FULL_WIDTH.has(item.name)
        ? { ...item.meta, gridSize: 1 as const }
        : item.meta,
    }));
}

const title = "audio/ui – Audio UI Components for React";
const description =
  "A set of accessible and composable Audio UI components. Built on top of shadcn/ui, designed to be copied, pasted, and owned.";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = buildPageMetadata({
  description,
  keywords: [
    "audio ui components",
    "react audio components",
    "shadcn audio components",
    "web audio react",
    "audio player react",
    "knob component react",
    "fader component react",
    "xy pad react",
    "channel strip react",
    "shadcn/ui audio",
    "shadcn create",
    "shadcn ui extensions",
    "shadcn ui components",
    "free shadcn components",
    "open-source shadcn components",
  ],
  path: "/",
  title,
});

export default function IndexPage() {
  const catalogItems = getShowcaseCatalogItems();

  return (
    <div className="homepage relative flex flex-1 flex-col">
      <ComponentShowcase catalogItems={catalogItems} />
    </div>
  );
}
