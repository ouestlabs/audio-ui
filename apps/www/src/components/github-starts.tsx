"use client";
import { StarIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useGithubStars } from "@/hooks/use-github";
import { Icons } from "@/lib/icons";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/registry/default/ui/button-group";
import { Kbd, KbdGroup } from "@/registry/default/ui/kbd";
import { Skeleton } from "@/registry/default/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/default/ui/tooltip";

function GithubStars() {
  const { stargazersCount, isLoading } = useGithubStars(
    "ouestlabs",
    "audio-ui"
  );

  return (
    <Tooltip>
      <TooltipTrigger render={<ButtonGroup />}>
        <Button
          render={
            <Link
              aria-label="GitHub"
              href="https://github.com/ouestlabs/audio-ui"
              rel="noopener noreferrer"
              target="_blank"
            />
          }
          variant="outline"
        >
          <Icons.github />
        </Button>
        <ButtonGroupText
          className={cn(
            "tabular-num relative text-muted-foreground",
            isLoading && "px-1"
          )}
        >
          {isLoading ? (
            <Skeleton className="h-6.5 w-11 rounded-s-none rounded-e-full bg-background/50" />
          ) : (
            new Intl.NumberFormat("en-US", {
              notation: "compact",
              compactDisplay: "short",
            }).format(stargazersCount)
          )}
        </ButtonGroupText>
      </TooltipTrigger>
      <TooltipContent>
        <KbdGroup>
          {new Intl.NumberFormat("en-US").format(stargazersCount)} stars
          <Kbd>
            <StarIcon weight="duotone" />
          </Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}

export { GithubStars };
