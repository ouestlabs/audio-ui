"use client";

import { BookOpenTextIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { isCanonicalComponentDoc } from "@/lib/seo";

export function ComponentDocsLink({ slug }: { slug: string }) {
  if (!isCanonicalComponentDoc(slug)) {
    return null;
  }

  const docsHref = `/docs/components/base/${slug}`;

  return (
    <Button
      className="shrink-0"
      nativeButton={false}
      render={
        <Link to={docsHref}>
          <BookOpenTextIcon className="size-3.5 opacity-60" />
          View docs
        </Link>
      }
      variant="outline"
    />
  );
}
