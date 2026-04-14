import { RssSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="flex flex-col gap-0.5 group-has-[.docs-nav]/body:pb-20 group-has-[.docs-nav]/body:sm:pb-0">
      <p>
        <Link className="font-heading text-lg" href="/">
          audio/<span className="text-muted-foreground/64">ui</span>
        </Link>
      </p>
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-1 text-muted-foreground text-sm">
          Built by{" "}
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
        </p>
        <Link
          className="inline-flex items-center gap-1 self-start font-semibold text-orange-600 text-xs hover:text-orange-700 hover:underline dark:text-orange-500 dark:hover:text-orange-400"
          href="/rss.xml"
          rel="noopener noreferrer"
          target="_blank"
        >
          <RssSimpleIcon className="size-3" />
          RSS
        </Link>
      </div>
    </footer>
  );
}
