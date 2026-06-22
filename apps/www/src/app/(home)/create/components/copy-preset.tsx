"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useBuilder } from "./builder-provider";

function presetHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}

export function CopyPreset() {
  const { params } = useBuilder();
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });

  const presetCode = `--preset ${presetHash(
    `${params.style}:${params.baseColor}:${params.theme}:${params.radius}:${params.font}`
  )}`;

  return (
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
  );
}
