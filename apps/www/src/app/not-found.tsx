import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Page Not Found",
  description:
    "The page you're looking for doesn't exist or may have been moved.",
  path: "/404",
  robots: { index: false, follow: true },
});

export default function NotFound() {
  return (
    <div className="relative flex min-h-svh flex-col overscroll-none bg-site-background font-site-sans">
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
            render={<Link href="/" />}
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
