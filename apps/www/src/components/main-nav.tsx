"use client";

import { ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";
import { Link, useLocation } from "@tanstack/react-router";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn, isActive } from "@/lib/utils";

export function MainNav({
  items,
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  items: { href: string; label: string; soon?: boolean }[];
}) {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <nav className={cn("flex items-center gap-0.5", className)} {...props}>
      {items.map((item) => {
        const active = !item.soon && isActive(pathname, item.href);

        const buttonClassName = cn(
          "relative",
          active && "bg-site-muted text-site-primary",
          item.soon && "opacity-60"
        );

        const button = item.soon ? (
          <Button className={buttonClassName} size="sm" variant="ghost">
            <span>{item.label}</span>
          </Button>
        ) : (
          <Button
            className={buttonClassName}
            nativeButton={false}
            render={
              item.href.startsWith("https://") ? (
                <Link
                  className="flex items-center gap-0.5"
                  rel="noreferrer"
                  target="_blank"
                  to={item.href}
                >
                  {item.label} <ArrowSquareOutIcon className="size-3.5" />
                </Link>
              ) : (
                <Link to={item.href}>{item.label}</Link>
              )
            }
            variant="ghost"
          />
        );

        return <React.Fragment key={item.href}>{button}</React.Fragment>;
      })}
    </nav>
  );
}
