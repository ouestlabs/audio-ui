"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

export function DocsCopyPage({ page }: { page: string; url: string }) {
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  return (
    <Button
      className="site-rounded-md h-8 shadow-none md:h-7 md:text-[0.8rem]"
      onClick={() => copyToClipboard(page)}
      size="sm"
      variant="secondary"
    >
      <span className="relative inline-flex">
        <CheckIcon
          aria-hidden="true"
          className={cn(
            "absolute inset-0 transition-[opacity,filter,scale] duration-250 ease-in-out will-change-[opacity,filter,scale] motion-reduce:transition-none",
            isCopied
              ? "scale-100 opacity-100 blur-0"
              : "scale-[0.25] opacity-0 blur-[2px]"
          )}
        />
        <CopyIcon
          aria-hidden="true"
          className={cn(
            "transition-[opacity,filter,scale] duration-250 ease-in-out will-change-[opacity,filter,scale] motion-reduce:transition-none",
            isCopied
              ? "scale-[0.25] opacity-0 blur-[2px]"
              : "scale-100 opacity-100 blur-0"
          )}
        />
      </span>
      Copy Markdown
    </Button>
  );
}
