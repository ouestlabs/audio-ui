"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

export function DocsCopyPage({ page }: { page: string; url: string }) {
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  return (
    <Button
      className="site-rounded-md h-8 shadow-none md:h-7 md:text-[0.8rem]"
      onClick={() => copyToClipboard(page)}
      size="sm"
      variant="secondary"
    >
      {isCopied ? <CheckIcon /> : <CopyIcon />}
      Copy Markdown
    </Button>
  );
}
