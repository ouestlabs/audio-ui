"use client";

import Link from "next/link";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGithubStars } from "@/hooks/use-github";
import { siteConfig } from "@/lib/config";

export function GitHubLink() {
  return (
    <Button
      className="shadow-none"
      nativeButton={false}
      render={
        <Link href={siteConfig.links.github} rel="noreferrer" target="_blank">
          <Icons.gitHub />
          <StarsCount />
        </Link>
      }
      variant="ghost"
    />
  );
}

function StarsCount() {
  const { stargazersCount, isLoading } = useGithubStars(
    "ouestlabs",
    "audio-ui"
  );

  if (isLoading) {
    return <Skeleton className="h-4 w-6" />;
  }

  return (
    <span className="w-6 text-site-muted-foreground text-xs tabular-nums">
      {stargazersCount >= 1000
        ? `${(stargazersCount / 1000).toFixed(1)}k`
        : String(stargazersCount)}
    </span>
  );
}
