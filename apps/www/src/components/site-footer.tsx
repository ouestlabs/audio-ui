import { RssSimpleIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export function SiteFooter({ docs = false }: { docs?: boolean }) {
  return (
    <footer
      className={cn(
        "3xl:fixed:bg-transparent font-site-sans dark:bg-transparent",
        docs && "pb-20 sm:pb-0"
      )}
    >
      <div className={cn("container-wrapper")}>
        <div
          className={cn(
            "container flex flex-col items-center justify-center gap-2 py-4 md:h-16 md:flex-row md:gap-4",
            docs && "max-w-none px-0"
          )}
        >
          <div className="order-1 flex items-center gap-2.5 text-balance text-xs md:order-2">
            <div>
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
            <Separator orientation="vertical" />

            <Link
              className="ont-medium inline-flex items-center gap-1 text-orange-600 text-xs hover:text-orange-700 hover:underline dark:text-orange-500 dark:hover:text-orange-400"
              href="/rss.xml"
              rel="noopener noreferrer"
              target="_blank"
            >
              <RssSimpleIcon className="size-3" />
              RSS
            </Link>
            <Separator orientation="vertical" />

            <a
              className="font-medium text-xs hover:underline"
              href={siteConfig.links.twitter}
              rel="noopener noreferrer"
              target="_blank"
            >
              X
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
