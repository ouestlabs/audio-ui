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
  const { customizerOpen, toggleCustomizer } = useCustomizer();

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

  if (customizerOpen) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className="hidden lg:inline-flex"
            onClick={toggleCustomizer}
            variant="outline"
          >
            <SlidersHorizontalIcon className="size-4" weight="bold" />
            Customize
          </Button>
        }
      />
      <TooltipContent className="flex items-center gap-2" side="right">
        Open customizer
        <Kbd>C</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
