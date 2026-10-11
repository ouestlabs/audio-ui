import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** The top of the landing page: what audio/ui is, where to go, how to start. */
export function HomeHero() {
  return (
    <div className="flex flex-col items-start gap-6 px-3 pt-10 pb-6 sm:px-8 sm:pt-14 xl:px-10">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-balance font-medium font-serif text-4xl leading-tight sm:text-5xl">
          Audio UI for React
        </h1>
        <p className="text-balance text-base text-site-muted-foreground sm:text-lg">
          Accessible, composable audio components built on shadcn/ui. Copy them,
          paste them, own them.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          nativeButton={false}
          render={
            <Link href="/docs/get-started">
              Get started <ArrowRightIcon aria-hidden weight="bold" />
            </Link>
          }
        />
        <Button
          nativeButton={false}
          render={<Link href="/components">Browse components</Link>}
          variant="outline"
        />
      </div>
    </div>
  );
}
