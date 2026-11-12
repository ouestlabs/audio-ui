import { CornersInIcon, CornersOutIcon } from "@phosphor-icons/react/ssr";
import { useLocation } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import {
  setEditorExpanded,
  useEditorExpanded,
} from "@/components/site/home/editor-expanded";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Where Escape belongs to what has the focus: a field, or a menu, a list or a dialog open over the page. */
const KEEPS_ESCAPE =
  "input, textarea, select, [contenteditable], [role=menu], [role=listbox], [role=dialog]";

/**
 * In the bar, on the home: the audio editor fills the inset, the title and the
 * page under it out of its way, and takes it back. Escape does the same.
 */
export function ExpandEditor() {
  const home = useLocation({ select: (location) => location.pathname === "/" });
  const expanded = useEditorExpanded();
  const toggle = useCallback(() => setEditorExpanded(!expanded), [expanded]);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        (event.target instanceof Element && event.target.closest(KEEPS_ESCAPE))
      ) {
        return;
      }
      setEditorExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  if (!home) {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Expand the editor"
            aria-pressed={expanded}
            className="text-site-muted-foreground"
            onClick={toggle}
            size="icon"
            variant="outline"
          >
            {expanded ? (
              <CornersInIcon aria-hidden />
            ) : (
              <CornersOutIcon aria-hidden />
            )}
          </Button>
        }
      />
      <TooltipContent className="flex items-center gap-2" side="bottom">
        {expanded ? (
          <>
            Collapse the editor <Kbd>Esc</Kbd>
          </>
        ) : (
          "Expand the editor"
        )}
      </TooltipContent>
    </Tooltip>
  );
}
