import Link from "next/link";
import type * as React from "react";
import { baseUrl } from "@/lib/config";
import { Icons } from "@/lib/icons";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";

export function OpenInV0Button({
  name,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  name: string;
}) {
  return (
    <Button
      className={cn(className)}
      render={
        <Link
          href={`https://v0.dev/chat/api/open?url=${encodeURIComponent(`${baseUrl.origin}/r/${name}.json`)}`}
          rel="noopener noreferrer"
          target="_blank"
        />
      }
      size="sm"
      {...props}
    >
      Open in <Icons.v0 />
    </Button>
  );
}
