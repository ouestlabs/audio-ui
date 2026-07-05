import { RssSimpleIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function SiteFooter() {
  return (
    <footer className="3xl:fixed:bg-transparent font-site-sans group-has-[[data-variant=sidebar][data-state=expanded]]/body:ml-64 group-has-[.section-soft]/body:bg-site-surface/40 group-has-[.docs-nav]/body:pb-20 group-has-[.docs-nav]/body:sm:pb-0 dark:bg-transparent">
      <div className={cn("container-wrapper")}>
        <div className="container flex flex-col items-center justify-center gap-2 py-4 group-has-[.docs-nav]/body:max-w-none group-has-[.docs-nav]/body:px-0 md:h-16 md:flex-row md:gap-4">
          <div className="order-1 flex items-center gap-2.5 text-balance text-xs md:order-2">
            <div className="inline-flex items-center gap-1">
              <span className="text-site-muted-foreground">Built by</span>{" "}
              <a
                className="font-semibold hover:underline"
                href="https://github.com/ouestlabs"
                rel="noopener noreferrer"
                target="_blank"
              >
                Ouest Labs
              </a>
              , the source code is available on{" "}
              <a
                className="font-semibold hover:underline"
                href="https://github.com/ouestlabs/audio-ui"
                rel="noopener noreferrer"
                target="_blank"
              >
                GitHub
              </a>
              .
            </div>
            <Separator className="h-4!" orientation="vertical" />

            <Link
              className="ont-medium inline-flex items-center gap-1 text-orange-600 text-xs hover:text-orange-700 hover:underline dark:text-orange-500 dark:hover:text-orange-400"
              href="/rss.xml"
              rel="noopener noreferrer"
              target="_blank"
            >
              <RssSimpleIcon className="size-3" />
              RSS
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
