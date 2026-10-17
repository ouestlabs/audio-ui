import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site/layout/footer";
import { SiteHeader } from "@/components/site/navigation/header";
import { Button } from "@/components/ui/button";

/** What a missing address says, and the way back home. It sits in the site's frame, between its sidebars. Not indexed. */
export function NotFoundContent() {
  return (
    <div className="flex min-h-[60svh] flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <title>Page Not Found</title>
      <meta content="noindex, follow" name="robots" />
      <h1 className="text-balance font-semibold text-3xl text-site-foreground tracking-tight md:text-4xl">
        Page Not Found
      </h1>
      <p className="max-w-md text-balance text-site-muted-foreground">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Button
        className="group mt-4"
        nativeButton={false}
        render={<Link to="/" />}
      >
        <CaretLeftIcon
          aria-hidden="true"
          className="group-hover:-translate-x-0.5 opacity-60 transition-transform"
        />
        Back to Home
      </Button>
    </div>
  );
}

/** The same outside the site's layout, for an address no route claims: the header and the footer around it. */
export function NotFoundPage() {
  return (
    <div className="relative flex min-h-svh flex-col overscroll-none bg-site-background font-site-sans">
      <SiteHeader />
      <NotFoundContent />
      <SiteFooter />
    </div>
  );
}
