"use client";

import { GalleryHorizontalIcon } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { useLayout } from "@/hooks/use-layout";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

export function SiteConfig({ className }: React.ComponentProps<typeof Button>) {
  const { layout, setLayout } = useLayout();

  return (
    <Button
      className={cn("size-8", className)}
      onClick={() => {
        const newLayout = layout === "fixed" ? "full" : "fixed";
        setLayout(newLayout);
        trackEvent({
          name: "set_layout",
          properties: { layout: newLayout },
        });
      }}
      size="icon"
      title="Toggle layout"
      variant="ghost"
    >
      <span className="sr-only">Toggle layout</span>
      <GalleryHorizontalIcon />
    </Button>
  );
}
