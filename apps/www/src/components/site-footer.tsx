import { RssSimpleIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { FrameFooter } from "@/components/custom/frame";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/lib/config";

function FooterLinks() {
  return (
    <div className="flex items-center gap-2.5 text-balance text-xs">
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
  );
}

/** In the docs it is the footer of the page's frame; elsewhere, the site's. */
export function SiteFooter({ docs = false }: { docs?: boolean }) {
  if (docs) {
    return (
      <FrameFooter className="shrink-0 flex-row items-center justify-center px-2 py-2.5">
        <FooterLinks />
      </FrameFooter>
    );
  }
  return (
    <footer className="3xl:fixed:bg-transparent font-site-sans dark:bg-transparent">
      <div className="container-wrapper">
        <div className="container flex flex-col items-center justify-center gap-2 py-4 md:h-16 md:flex-row md:gap-4">
          <FooterLinks />
        </div>
      </div>
    </footer>
  );
}
