import type { Metadata } from "next";
import { ComponentRenderer } from "@/app/(create)/components/components/component-card-container";
import { buildPageMetadata } from "@/lib/seo";

import { HomeHero } from "./components/home-hero";

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
  return (
    <div className="homepage flex min-h-0 flex-1 flex-col">
      <HomeHero />
      {/* The product fills the panel: the piano roll, playable at once. */}
      <div className="flex min-h-0 flex-1 flex-col p-4 font-sans sm:p-6 [&_.cn-audio-panel]:h-full [&_.cn-audio-panel]:overflow-hidden [&_[data-slot=piano-roll]]:h-auto [&_[data-slot=piano-roll]]:min-h-0 [&_[data-slot=piano-roll]]:flex-1">
        <ComponentRenderer name="block-piano-roll" />
      </div>
    </div>
  );
}
