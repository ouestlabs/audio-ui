"use client";

import { SlideshowIcon } from "@phosphor-icons/react";
import { useLayout } from "@/hooks/use-layout";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";

export function SiteConfig({ className }: React.ComponentProps<typeof Button>) {
  const { layout, setLayout } = useLayout();

  return (
    <Button
      className={cn(className)}
      onClick={() => {
        const newLayout = layout === "fixed" ? "full" : "fixed";
        setLayout(newLayout);
      }}
      size="icon"
      title="Toggle layout"
      variant="ghost"
    >
      <span className="sr-only">Toggle layout</span>
      <SlideshowIcon />
    </Button>
  );
}
