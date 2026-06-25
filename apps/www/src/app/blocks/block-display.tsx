import { InfoIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import React from "react";
import type { registryItemSchema } from "shadcn/schema";
import type { z } from "zod";
import { Command, CopyButton } from "@/components/md/code";
import { Source } from "@/components/md/preview";
import { appConfig, baseUrl } from "@/lib/config";
import { highlightCode } from "@/lib/highlight-code";
import { Icons } from "@/lib/icons";
import { getRegistryItem } from "@/lib/registry";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { ButtonGroup } from "@/registry/bases/base/ui/button-group";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/registry/bases/base/ui/drawer";

export type Block = z.infer<typeof registryItemSchema> & {
  highlightedCode: string;
};

function BlockCodeDrawer({
  name,
  filePath,
  fileContent = "",
}: {
  name: string;
  filePath?: string;
  fileContent?: string;
}) {
  return (
    <Drawer position="right">
      <DrawerTrigger render={<Button size="sm" variant="outline" />}>
        View code
      </DrawerTrigger>
      <DrawerPopup
        className="max-w-2xl"
        position="right"
        showBar
        variant="straight"
      >
        <DrawerHeader allowSelection>
          <DrawerTitle>View code</DrawerTitle>
          <DrawerDescription>
            Install with the CLI, then browse the source below.
          </DrawerDescription>
          <Command
            __bun__={`bunx --bun shadcn@latest add @audio/${name}`}
            __npm__={`npx shadcn@latest add @audio/${name}`}
            __pnpm__={`pnpm dlx shadcn@latest add @audio/${name}`}
            __yarn__={`yarn dlx shadcn@latest add @audio/${name}`}
          />
        </DrawerHeader>
        <DrawerPanel
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          scrollable={false}
          scrollFade={false}
        >
          <Source
            collapsible={false}
            copyButton={false}
            fillHeight
            headerActions={
              <ButtonGroup>
                <CopyButton value={fileContent} variant="outline" />
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={`https://v0.dev/chat/api/open?url=${encodeURIComponent(`${baseUrl.origin}/r/${name}.json`)}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    />
                  }
                  size="icon"
                  variant="outline"
                >
                  <Icons.v0 />
                </Button>
              </ButtonGroup>
            }
            name={name}
            pathLabel={filePath}
          />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  );
}

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
        "relative flex min-w-0 flex-col rounded-4xl bg-card ring-1 ring-border/80",
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
          <CopyButton
            icon={<Icons.mcp />}
            size="icon-sm"
            tooltip="Copy Registry URL"
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
