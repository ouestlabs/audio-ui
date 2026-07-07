"use client";

import { BookOpenTextIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import { isCanonicalComponentDoc } from "@/lib/seo";

export function ComponentDocsLink({ slug }: { slug: string }) {
  const mounted = useMounted();
  const [params] = useDesignSystemSearchParams();
  const [config] = useConfig();

  if (!isCanonicalComponentDoc(slug)) {
    return null;
  }

  const base = mounted
    ? (params.base ?? config.base ?? "base")
    : (params.base ?? "base");
  const docsHref = `/docs/components/${base === "radix" ? "radix" : "base"}/${slug}`;

  return (
    <Button
      className="shrink-0"
      nativeButton={false}
      render={
        <Link href={docsHref}>
          <BookOpenTextIcon className="size-3.5 opacity-60" />
          View docs
        </Link>
      }
      variant="outline"
    />
  );
}
