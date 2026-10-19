import { MoonIcon, SunIcon } from "@phosphor-icons/react/ssr";
import { useTheme } from "next-themes";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Whether a key press is for a field: the shortcut leaves it alone. */
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Light and dark, as the docs have it: a button, and the D key. */
export function ModeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = useCallback(
    () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    [resolvedTheme, setTheme]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "d" ||
        event.metaKey ||
        event.ctrlKey ||
        isTyping(event.target)
      ) {
        return;
      }
      event.preventDefault();
      toggleTheme();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggleTheme]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Toggle theme"
            onClick={toggleTheme}
            size="icon"
            variant="outline"
          >
            <span className="relative flex items-center justify-center">
              <SunIcon
                aria-hidden="true"
                className="absolute inset-0 m-auto scale-[0.25] opacity-0 blur-[2px] transition-[opacity,filter,scale] duration-250 ease-in-out motion-reduce:transition-none [html.dark_&]:scale-100 [html.dark_&]:opacity-100 [html.dark_&]:blur-[0px]"
              />
              <MoonIcon
                aria-hidden="true"
                className="scale-[0.25] opacity-0 blur-[2px] transition-[opacity,filter,scale] duration-250 ease-in-out motion-reduce:transition-none [html.light_&]:scale-100 [html.light_&]:opacity-100 [html.light_&]:blur-[0px]"
              />
            </span>
          </Button>
        }
      />
      <TooltipContent side="bottom">Toggle theme (D)</TooltipContent>
    </Tooltip>
  );
}
