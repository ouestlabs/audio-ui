import { SparkleIcon } from "@audio-ui/icons/react";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/** The line above the product on the landing page: what it is, and where to start. */
export function HomeHero() {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 pt-4 sm:px-6">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-balance font-medium font-site-heading text-2xl leading-tight sm:text-3xl">
          Audio UI for React
        </h1>
        <p className="text-balance text-site-muted-foreground text-sm">
          Knobs, faders, meters, waveforms, timelines and piano rolls, as
          headless React primitives on npm or as components you install with the
          shadcn CLI.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          nativeButton={false}
          render={
            <Link params={{ _splat: "get-started" }} to="/docs/$">
              Get started <ArrowRightIcon aria-hidden weight="bold" />
            </Link>
          }
        />
        <Button
          nativeButton={false}
          render={<Link to="/components">Browse components</Link>}
          variant="outline"
        />
        <Button
          nativeButton={false}
          render={
            <Link params={{ _splat: "agents" }} to="/docs/$">
              <SparkleIcon aria-hidden className="size-4" />
              For agents
            </Link>
          }
          variant="ghost"
        />
      </div>
    </div>
  );
}
