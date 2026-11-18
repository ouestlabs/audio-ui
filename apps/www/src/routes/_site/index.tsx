import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import {
  setEditorExpanded,
  useEditorExpanded,
} from "@/components/site/home/editor-expanded";
import { HomeGuide } from "@/components/site/home/home-guide";
import { HomeHero } from "@/components/site/home/home-hero";
import { JsonLd } from "@/components/site/json-ld";
import { siteConfig } from "@/lib/config";
import { getHomeIndex } from "@/lib/docs/content/spaces";
import { buildPageMetadata, buildSoftwareJsonLd } from "@/lib/seo/seo";
import BlockAudioEditor from "@/registry/bases/base/components/audio-editor/react/block-audio-editor";

/** The component spaces and the guides, read once on the server. */
const loadHome = createServerFn({ method: "GET" }).handler(() =>
  getHomeIndex()
);

const title = "audio/ui: the Audio UI Component Library for React";

export const Route = createFileRoute("/_site/")({
  // Its audio editor is the registry's, for every framework: each choice of the customizer shows on it.
  staticData: { customizer: "all" },
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
  const { guides, primitives, spaces } = Route.useLoaderData();
  // The bar's button gives the editor the whole inset; leaving the home gives it back.
  const expanded = useEditorExpanded();
  useEffect(() => () => setEditorExpanded(false), []);
  return (
    <>
      <JsonLd data={buildSoftwareJsonLd()} />
      {expanded ? null : <HomeHero />}
      {/* Under the title, the registry's audio editor itself: what a user installs, working. */}
      <section
        aria-labelledby="home-editor"
        className={expanded ? "flex flex-1 flex-col" : "border-t"}
      >
        <h2 className="sr-only" id="home-editor">
          Audio editor
        </h2>
        <BlockAudioEditor />
      </section>
      {/* A hatched band between the editor and the rest of the page: the editor ends here. */}
      <div
        aria-hidden="true"
        className="h-6 shrink-0 border-y bg-[repeating-linear-gradient(-45deg,var(--border)_0_1px,transparent_1px_7px)]"
        hidden={expanded}
      />
      {/* Under it, the page in words, the library's figures with the components: what search engines and agents read without running it. */}
      {expanded ? null : (
        <HomeGuide guides={guides} primitives={primitives} spaces={spaces} />
      )}
    </>
  );
}
