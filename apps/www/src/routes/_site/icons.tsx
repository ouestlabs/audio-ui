import { catalog, categories } from "@audio-ui/icons";
import { BookOpenTextIcon } from "@phosphor-icons/react/ssr";
import { createFileRoute, Link } from "@tanstack/react-router";
import { IconGrid } from "@/components/icons/icon-grid";
import { JsonLd } from "@/components/site/json-ld";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo/seo";

const description = `${catalog.length} free audio icons for React and any framework: knobs, faders, transport, filters and waveforms. One thin stroke on a 24 grid, in four weights. Search them, pick a weight and a size, then copy or save the SVG.`;

export const Route = createFileRoute("/_site/icons")({
  // The panel at the side is the icons' own: the icon picked, its weight and its size.
  staticData: { customizer: "icons" },
  component: IconsPage,
  head: () =>
    buildPageMetadata({
      description,
      keywords: [
        "audio icons",
        "music icons",
        "daw icons",
        "synth icons",
        "react audio icons",
        "svg icons",
        "@audio-ui/icons",
      ],
      path: "/icons",
      title: "Audio Icons",
      titleSuffix: siteConfig.name,
    }),
});

function IconsPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: siteConfig.name, path: "/" },
          { name: "Icons", path: "/icons" },
        ])}
      />
      <section className="w-full px-6 pt-8 pb-6 sm:px-8 xl:px-10">
        <div className="flex w-full flex-wrap items-end justify-between gap-3">
          <h1 className="mt-3 min-w-0 flex-1 text-balance font-bold text-xl sm:text-3xl">
            Audio Icons
          </h1>
          <Button
            className="shrink-0"
            nativeButton={false}
            render={
              <Link params={{ _splat: "icons" }} to="/docs/$">
                <BookOpenTextIcon className="size-3.5 opacity-60" />
                Usage
              </Link>
            }
            variant="outline"
          />
        </div>
        <p className="mt-4 max-w-3xl text-pretty text-base text-site-muted-foreground leading-7">
          {catalog.length} glyphs in {categories.length} categories, drawn for
          what a general icon set does not draw: a knob, a rack unit, the shape
          of a sawtooth, the response of a high shelf. Pick one to see it in the
          panel, with its weight and its size, then copy or save its SVG.
        </p>
      </section>
      <div className="px-6 pb-12 sm:px-8 xl:px-10">
        <IconGrid />
      </div>
    </>
  );
}
