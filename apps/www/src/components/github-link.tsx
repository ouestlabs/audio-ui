"use client";

import Link from "next/link";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useGithubStars } from "@/hooks/use-github";
import { siteConfig } from "@/lib/config";

export function GitHubLink() {
  return (
    <ButtonGroup>
      <Button
        className="shadow-none"
        nativeButton={false}
        render={
          <Link
            href={siteConfig.links.github}
            rel="noreferrer"
            target="_blank"
          />
        }
        variant="outline"
      >
        <Icons.gitHub />
      </Button>
      <ButtonGroupText className="p-1">
        <StarsCount />
      </ButtonGroupText>
    </ButtonGroup>
  );
}

function StarsCount() {
  const { stargazersCount, isLoading } = useGithubStars(
    "ouestlabs",
    "audio-ui"
  );

  if (isLoading) {
    return <Skeleton className="w-6 h-5 border rounded-sm" />;
  }

  return (
    <span className="w-6 text-site-muted-foreground text-center text-xs tabular-nums">
      {stargazersCount >= 1000
        ? `${(stargazersCount / 1000).toFixed(1)}k`
        : String(stargazersCount)}
    </span>
  );
}
