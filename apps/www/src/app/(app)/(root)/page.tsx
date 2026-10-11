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
    <div className="homepage flex flex-1 flex-col justify-center px-3 py-10 sm:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-10">
        <HomeHero />
        {/* One component stands for the project: a synth built from the primitives, bare, as a thing to play with rather than a catalog card. */}
        <ComponentRenderer name="block-pocket-synth" />
      </div>
    </div>
  );
}
