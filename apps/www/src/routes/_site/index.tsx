import { createFileRoute } from "@tanstack/react-router";
import { ComponentRenderer } from "@/components/catalog/card/component-card-container";
import { HomeHero } from "@/components/site/home/home-hero";
import { HomeTimelineSkeleton } from "@/components/site/home/home-timeline-skeleton";
import { JsonLd } from "@/components/site/json-ld";
import { siteConfig } from "@/lib/config";
import { buildPageMetadata, buildSoftwareJsonLd } from "@/lib/seo/seo";

const title = "audio/ui – Audio UI Components for React";

export const Route = createFileRoute("/_site/")({
  component: IndexPage,
  head: () =>
    buildPageMetadata({
      description: siteConfig.description,
      keywords: [
        "audio ui components",
        "react audio components",
        "shadcn audio components",
        "headless audio primitives react",
        "audio ui mcp server",
        "audio ui agent skill",
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
    }),
});

function IndexPage() {
  return (
    <div className="homepage flex min-h-0 flex-1 flex-col">
      <JsonLd data={buildSoftwareJsonLd()} />
      <HomeHero />
      {/* The product fills the panel: the arrangement, playable at once. */}
      <section
        aria-labelledby="home-demo-heading"
        className="flex min-h-0 flex-1 flex-col p-4 font-sans sm:p-6 [&_.cn-audio-panel]:h-full [&_.cn-audio-panel]:overflow-hidden [&_[data-slot=piano-roll]]:h-auto [&_[data-slot=piano-roll]]:min-h-0 [&_[data-slot=piano-roll]]:flex-1 [&_[data-slot=timeline]]:flex [&_[data-slot=timeline]]:min-h-0 [&_[data-slot=timeline]]:flex-1 [&_[data-slot=timeline]]:flex-col [&_[data-slot=piano-roll-viewport]>div]:min-h-[calc(var(--piano-roll-rows)*1.25rem)]"
      >
        <h2 className="sr-only" id="home-demo-heading">
          Live demo: an arrangement timeline built with audio/ui
        </h2>
        <ComponentRenderer
          loading={<HomeTimelineSkeleton />}
          name="block-timeline"
        />
      </section>
    </div>
  );
}
