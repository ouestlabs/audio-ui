import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { buildPageMetadata } from "@/lib/seo";

import Hero from "./components/hero";

const title = "audio/ui – Audio UI Components for React";
const description =
  "A set of accessible and composable Audio UI components. Built on top of shadcn/ui, designed to be copied, pasted, and owned.";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: "/",
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
});

export default function IndexPage() {
  return (
    <div className="homepage relative overflow-hidden bg-linear-to-b to-35% to-background">
      <Hero />
      <SiteFooter />
    </div>
  );
}
