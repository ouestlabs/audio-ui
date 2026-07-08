"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react/ssr";
import { useTheme } from "next-themes";
import * as React from "react";
import { PreviewShortcutForwarder } from "@/components/preview-shortcut-forwarder";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMetaColor } from "@/hooks/use-meta-color";

export const DARK_MODE_FORWARD_TYPE = "dark-mode-forward";

const DARK_MODE_KEYS = ["d"] as const;

export function ModeSwitcher() {
  const { setTheme, resolvedTheme } = useTheme();
  const { setMetaColor, metaColor } = useMetaColor();

  React.useEffect(() => {
    setMetaColor(metaColor);
  }, [metaColor, setMetaColor]);

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "d" || e.key === "D") && !e.metaKey && !e.ctrlKey) {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }

        e.preventDefault();
        toggleTheme();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggleTheme]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className="group/toggle extend-touch-target"
            onClick={toggleTheme}
            size="icon"
            variant="outline"
          >
            <span className="relative flex items-center justify-center">
              <SunIcon
                aria-hidden="true"
                className="absolute inset-0 m-auto scale-[0.25] opacity-0 blur-[2px] transition-[opacity,filter,scale] duration-250 ease-in-out will-change-[opacity,filter,scale] motion-reduce:transition-none [html.dark_&]:scale-100 [html.dark_&]:opacity-100 [html.dark_&]:blur-[0px]"
              />
              <MoonIcon
                aria-hidden="true"
                className="scale-[0.25] opacity-0 blur-[2px] transition-[opacity,filter,scale] duration-250 ease-in-out will-change-[opacity,filter,scale] motion-reduce:transition-none [html.light_&]:scale-100 [html.light_&]:opacity-100 [html.light_&]:blur-[0px]"
              />
            </span>
            <span className="sr-only">Toggle theme</span>
          </Button>
        }
      />
      <TooltipContent className="flex items-center gap-2 pr-1">
        Toggle Mode <Kbd>D</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

export function DarkModeScript() {
  return (
    <PreviewShortcutForwarder
      forwardType={DARK_MODE_FORWARD_TYPE}
      keys={DARK_MODE_KEYS}
    />
  );
}
