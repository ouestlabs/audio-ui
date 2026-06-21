"use client";

import {
  ArrowsClockwiseIcon,
  CheckIcon,
  CodeIcon,
  CopyIcon,
} from "@phosphor-icons/react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { THEMES } from "@/lib/themes";
import { Button } from "@/registry/default/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/default/ui/popover";
import { STYLES } from "@/registry/styles";
import { BASE_COLOR_NAMES, RADIUS_VALUES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import { InstallCommand } from "./install-command";

const pick = <T,>(values: readonly T[]): T =>
  values[Math.floor(Math.random() * values.length)] as T;

function presetHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}

export function PresetActions() {
  const { params, setParams } = useBuilder();
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });

  const presetCode = `--preset ${presetHash(
    `${params.style}:${params.baseColor}:${params.theme}:${params.radius}:${params.font}`
  )}`;

  const shuffle = () => {
    setParams({
      style: pick(STYLES),
      baseColor: pick(BASE_COLOR_NAMES),
      theme: pick(THEMES).name,
      radius: pick(RADIUS_VALUES),
    });
  };

  return (
    <>
      <button
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-foreground/5 px-3 py-2 font-mono text-muted-foreground text-xs ring-1 ring-foreground/10 transition-colors hover:text-foreground"
        onClick={() => copyToClipboard(presetCode)}
        type="button"
      >
        <span className="truncate">{presetCode}</span>
        {isCopied ? (
          <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" />
        ) : (
          <CopyIcon aria-hidden="true" className="size-3.5 shrink-0" />
        )}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={shuffle} size="sm" variant="outline">
          <ArrowsClockwiseIcon aria-hidden="true" className="size-4" />
          Shuffle
        </Button>
        <Popover>
          <PopoverTrigger render={<Button size="sm" />}>
            <CodeIcon aria-hidden="true" className="size-4" />
            Get Code
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80" side="top">
            <InstallCommand />
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
