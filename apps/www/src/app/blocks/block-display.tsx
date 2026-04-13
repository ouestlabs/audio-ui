import { InfoIcon } from "@phosphor-icons/react/dist/ssr";
import React from "react";
import type { registryItemSchema } from "shadcn/schema";
import type { z } from "zod";
import { BlockCodeDrawer } from "@/components/blocks/block-code-drawer";
import { CopyRegistry } from "@/components/copy-registry";
import { appConfig } from "@/lib/config";
import { highlightCode } from "@/lib/highlight-code";
import { getRegistryItem } from "@/lib/registry";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";

export type Block = z.infer<typeof registryItemSchema> & {
  highlightedCode: string;
};

export async function BlockDisplay({
  name,
  children,
  className,
}: { name: string } & React.ComponentProps<"div">) {
  const block = await getCachedRegistryItem(name);
  const highlightedCode = await getBlockHighlightedCode(
    block?.files?.[0]?.content ?? ""
  );

  if (!(block && highlightedCode)) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col rounded-4xl border bg-card",
        className
      )}
    >
      <div className="-m-px flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-4xl border bg-background p-4">
        <div className="mx-auto max-w-3xl" data-slot="block-wrapper">
          {children}
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-b-xl p-4">
        <p className="flex flex-1 gap-1 truncate text-muted-foreground text-xs">
          <InfoIcon className="size-3 h-lh shrink-0" />
          <span className="truncate">{block.description}</span>
        </p>
        <div className="flex items-center gap-1.5">
          {process.env.NODE_ENV === "development" && (
            <Button
              className="text-xs"
              disabled
              size="sm"
              title="Block name"
              variant="outline"
            >
              {block.name}
            </Button>
          )}
          <CopyRegistry
            value={`${appConfig.url}/r/${name}.json`}
            variant="outline"
          />
          <BlockCodeDrawer
            fileContent={block.files[0]?.content ?? ""}
            filePath={block.files[0]?.path}
            name={name}
          />
        </div>
      </div>
    </div>
  );
}

const getCachedRegistryItem = React.cache(
  async (name: string) => await getRegistryItem(name)
);

const getBlockHighlightedCode = React.cache(
  async (content: string) => await highlightCode(content)
);
