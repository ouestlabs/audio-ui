import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/layouts/global/headers/page";

import { Button } from "@/registry/bases/base/ui/button";

export const metadata: Metadata = {
  title: "Page Not Found",
  description:
    "The page you're looking for doesn't exist or may have been moved.",
};

export default function NotFound() {
  return (
    <div className="container flex h-full w-full grow flex-col items-center justify-center">
      <PageHeader>
        <PageHeaderHeading>Page Not Found</PageHeaderHeading>
        <PageHeaderDescription>
          The page you're looking for doesn't exist or may have been moved.
        </PageHeaderDescription>
        <div className="mt-4">
          <Button className="group" render={<Link href="/" />}>
            <CaretLeftIcon
              aria-hidden="true"
              className="group-hover:-translate-x-0.5 opacity-60 transition-transform"
            />
            Back to Home
          </Button>
        </div>
      </PageHeader>
    </div>
  );
}
