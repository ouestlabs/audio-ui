import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { HomeGuide } from "@/components/site/home/home-guide";
import { HomeHero } from "@/components/site/home/home-hero";
import { JsonLd } from "@/components/site/json-ld";
import { siteConfig } from "@/lib/config";
import { getDocsSpaces } from "@/lib/docs/content/spaces";
import { buildPageMetadata, buildSoftwareJsonLd } from "@/lib/seo/seo";

/** Every component page by space, read once on the server for the list on the page. */
const loadSpaces = createServerFn({ method: "GET" }).handler(() =>
  getDocsSpaces()
);

const title = "audio/ui: the Audio UI Component Library for React";

export const Route = createFileRoute("/_site/")({
  component: IndexPage,
  // The docs do not change while the site runs: read once, not on every visit.
  gcTime: Number.POSITIVE_INFINITY,
  loader: () => loadSpaces(),
  staleTime: Number.POSITIVE_INFINITY,
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
  const spaces = Route.useLoaderData();
  return (
    <>
      <JsonLd data={buildSoftwareJsonLd()} />
      <HomeHero />
      {/* Under it, the page in words: what search engines and agents read without running it. */}
      <HomeGuide spaces={spaces} />
    </>
  );
}
