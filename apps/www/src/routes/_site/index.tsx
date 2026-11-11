import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  type HomeFigure,
  HomeFigures,
} from "@/components/site/home/home-figures";
import { HomeGuide } from "@/components/site/home/home-guide";
import { HomeHero } from "@/components/site/home/home-hero";
import { HomePlayground } from "@/components/site/home/home-playground";
import { JsonLd } from "@/components/site/json-ld";
import { siteConfig } from "@/lib/config";
import packageModules from "@/lib/docs/content/package-modules.generated.json";
import { getHomeIndex } from "@/lib/docs/content/spaces";
import { buildPageMetadata, buildSoftwareJsonLd } from "@/lib/seo/seo";

const PACKAGES = ["react", "core", "engine", "elements", "icons"];

/** Last month's npm downloads of every package, or null when npm does not answer. */
async function monthlyDownloads(): Promise<number | null> {
  try {
    const counts = await Promise.all(
      PACKAGES.map(async (name) => {
        const response = await fetch(
          `https://api.npmjs.org/downloads/point/last-month/@audio-ui/${name}`,
          { signal: AbortSignal.timeout(4000) }
        );
        const body = (await response.json()) as { downloads?: number };
        return body.downloads ?? 0;
      })
    );
    return counts.reduce((sum, count) => sum + count, 0);
  } catch {
    return null;
  }
}

/** The component spaces, the guides and the figures, read once on the server. */
const loadHome = createServerFn({ method: "GET" }).handler(async () => {
  const { guides, spaces } = getHomeIndex();
  // A space's component pages, not the overview it may link to.
  const pagesOf = (name: string) =>
    spaces
      .find((space) => space.title === name)
      ?.sections.flatMap((section) => section.pages)
      .filter((page) => page.url.startsWith("/docs/components/")).length ?? 0;
  const downloads = await monthlyDownloads();
  const figures: HomeFigure[] = [
    {
      href: "/components",
      label: "Components",
      value: String(pagesOf("Elements") + pagesOf("Workstation")),
    },
    {
      href: "/docs/devices",
      label: "Devices",
      value: String(pagesOf("Devices")),
    },
    {
      href: "/docs/react",
      label: "Primitives",
      // The primitives are the entries the elements and React share: the elements' own, less the types of its frameworks.
      value: String(
        packageModules.filter(
          (each) =>
            each.from.startsWith("@audio-ui/elements/") && !each.typesOnly
        ).length
      ),
    },
    ...(downloads === null
      ? []
      : [
          {
            href: "https://www.npmjs.com/org/audio-ui",
            label: "npm downloads a month",
            value: `${Math.floor(downloads / 1000)}K+`,
          },
        ]),
  ];
  return { figures, guides, spaces };
});

const title = "audio/ui: the Audio UI Component Library for React";

export const Route = createFileRoute("/_site/")({
  component: IndexPage,
  // The docs do not change while the site runs: read once, not on every visit.
  gcTime: Number.POSITIVE_INFINITY,
  loader: () => loadHome(),
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
  const { figures, guides, spaces } = Route.useLoaderData();
  return (
    <>
      <JsonLd data={buildSoftwareJsonLd()} />
      <HomeHero />
      <HomePlayground />
      <HomeFigures figures={figures} />
      {/* Under it, the page in words: what search engines and agents read without running it. */}
      <HomeGuide guides={guides} spaces={spaces} />
    </>
  );
}
