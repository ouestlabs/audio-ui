import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

/** What a missing address shows: a word, and the way back home. Not indexed. */
export function NotFoundPage() {
  return (
    <div className="relative flex min-h-svh flex-col overscroll-none bg-site-background font-site-sans">
      <title>Page Not Found</title>
      <meta content="noindex, follow" name="robots" />
      <SiteHeader />
      <PageHeader className="flex flex-1 flex-col justify-center">
        <PageHeaderHeading>Page Not Found</PageHeaderHeading>
        <PageHeaderDescription>
          The page you're looking for doesn't exist or may have been moved.
        </PageHeaderDescription>
        <div className="mt-4">
          <Button
            className="group"
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
      </PageHeader>
      <SiteFooter />
    </div>
  );
}
