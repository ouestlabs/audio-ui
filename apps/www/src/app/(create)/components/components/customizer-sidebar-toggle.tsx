"use client";

import { GearSixIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
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
    <ButtonGroup>
      <ButtonGroupText>
        <GearSixIcon weight="duotone" />
      </ButtonGroupText>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button onClick={toggleCustomizer} variant="outline">
              <span className="inline-flex items-center gap-1">
                <Avatar className="size-4">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <span className="leading-none">/</span>
                <span className="leading-none">create</span>
              </span>
            </Button>
          }
        />
        <TooltipContent className="flex items-center gap-2" side="right">
          Toggle shadcn/create customizer
          <Kbd>C</Kbd>
        </TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}
