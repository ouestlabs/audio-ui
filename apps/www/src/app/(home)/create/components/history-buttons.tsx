"use client";

import {
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
} from "@phosphor-icons/react";
import { Button } from "@/registry/default/ui/button";
import { useBuilder } from "./builder-provider";

export function HistoryButtons() {
  const { canGoBack, canGoForward, goBack, goForward } = useBuilder();

  return (
    <div className="flex items-center gap-0.5">
      <Button
        aria-label="Undo"
        disabled={!canGoBack}
        onClick={goBack}
        size="icon"
        title="Undo"
        variant="ghost"
      >
        <ArrowBendUpLeftIcon aria-hidden="true" className="size-4" />
      </Button>
      <Button
        aria-label="Redo"
        disabled={!canGoForward}
        onClick={goForward}
        size="icon"
        title="Redo"
        variant="ghost"
      >
        <ArrowBendUpRightIcon aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
