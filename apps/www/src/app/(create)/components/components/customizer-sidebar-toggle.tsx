"use client";

import { SlidersHorizontalIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCustomizer } from "./components-context";

export function CustomizerSidebarToggle() {
  const { toggleCustomizer } = useCustomizer();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey) {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }

        e.preventDefault();
        toggleCustomizer();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggleCustomizer]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Customize"
            className="hidden text-site-muted-foreground lg:inline-flex"
            onClick={toggleCustomizer}
            size="icon"
            variant="outline"
          >
            <SlidersHorizontalIcon aria-hidden />
          </Button>
        }
      />
      <TooltipContent className="flex items-center gap-2" side="bottom">
        Customize
        <Kbd>C</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
