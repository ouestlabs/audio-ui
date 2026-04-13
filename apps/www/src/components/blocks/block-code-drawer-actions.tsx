"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { CopyCode } from "@/components/md/code";
import { baseUrl } from "@/lib/config";
import { Icons } from "@/lib/icons";
import { Button } from "@/registry/default/ui/button";
import { ButtonGroup } from "@/registry/default/ui/button-group";

export function BlockCodeDrawerActions({
  code,
  name,
}: {
  code: string;
  name: string;
}) {
  const v0Href = `https://v0.dev/chat/api/open?url=${encodeURIComponent(`${baseUrl.origin}/r/${name}.json`)}`;

  return (
    <ButtonGroup className="not-prose!">
      <CopyCode
        onCopied={() => {
          posthog.capture("text_copied_to_clipboard", {
            source: "block_drawer",
            copied_text_length: code.length,
          });
        }}
        value={code}
        variant="outline"
      />
      <Button
        aria-label="Open in v0"
        nativeButton={false}
        render={
          <Link href={v0Href} rel="noopener noreferrer" target="_blank" />
        }
        title="Open in v0"
      >
        <span>Open in</span>
        <Icons.v0 className="fill-background" />
      </Button>
    </ButtonGroup>
  );
}
