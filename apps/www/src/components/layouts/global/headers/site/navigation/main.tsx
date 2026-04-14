"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";

function MainNav({
  items,
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("items-center", className)} {...props}>
      {items.map((item) => (
        <Button
          data-pressed={pathname.includes(item.href) || undefined}
          key={item.href}
          nativeButton={false}
          render={
            <Link
              className={cn(pathname.includes(item.href) && "text-primary")}
              href={item.href}
              onClick={() => {
                posthog.capture("main_nav_link_clicked", {
                  href: item.href,
                  label: item.label,
                  current_pathname: pathname,
                });
              }}
            />
          }
          variant="ghost"
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}

export { MainNav };
