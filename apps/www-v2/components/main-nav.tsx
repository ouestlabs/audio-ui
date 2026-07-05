"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, isActive } from "@/lib/utils";

export function MainNav({
  items,
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  items: { href: string; label: string; pro?: boolean; soon?: boolean }[];
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center gap-0.5", className)} {...props}>
      {items.map((item) => {
        const active =
          !(item.soon || item.pro) && isActive(pathname, item.href);

        const button = (
          <Button
            asChild={!item.soon}
            className={cn(
              "relative",
              active && "bg-site-muted text-site-primary",
              item.soon && "opacity-60"
            )}
            size="sm"
            variant="ghost"
          >
            {item.soon ? (
              <span>{item.label}</span>
            ) : item.href ? (
              item.href.startsWith("https://") ? (
                <Link
                  className="flex items-center gap-0.5"
                  href={item.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.label} <ExternalLinkIcon className="size-3.5" />
                </Link>
              ) : (
                <Link href={item.href}>{item.label}</Link>
              )
            ) : null}
          </Button>
        );

        if (item.pro) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent className="max-w-50 leading-relaxed">
                🔥 Cooking something special! Join the waitlist for 40% off.
              </TooltipContent>
            </Tooltip>
          );
        }

        return <React.Fragment key={item.href}>{button}</React.Fragment>;
      })}
    </nav>
  );
}
