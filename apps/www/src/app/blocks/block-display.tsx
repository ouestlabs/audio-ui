import { InfoIcon } from "@phosphor-icons/react/dist/ssr";
import React from "react";
import type { registryItemSchema } from "shadcn/schema";
import type { z } from "zod";
import { BlockCodeDrawerActions } from "@/components/blocks/block-code-drawer-actions";
import { CopyRegistry } from "@/components/copy-registry";
import { Command } from "@/components/md/code";
import { Source } from "@/components/md/preview";
import { highlightCode } from "@/lib/highlight-code";
import { getRegistryItem } from "@/lib/registry";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/registry/default/ui/drawer";

export type Block = z.infer<typeof registryItemSchema> & {
  highlightedCode: string;
};

export async function BlockDisplay({
  name,
  children,
  className,
}: { name: string } & React.ComponentProps<"div">) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://audio-ui.vercel.app";
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
      <div className="flex items-center gap-3 rounded-b-xl p-2">
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
          <CopyRegistry value={`${baseUrl}/r/${name}.json`} variant="outline" />
          <Drawer position="right">
            <DrawerTrigger render={<Button size="sm" variant="outline" />}>
              View code
            </DrawerTrigger>
            <DrawerPopup
              className="max-h-dvh min-h-0 w-full max-w-2xl"
              position="right"
              showBar
              variant="straight"
            >
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <DrawerHeader allowSelection className="shrink-0">
                  <DrawerTitle>View code</DrawerTitle>
                  <DrawerDescription>
                    Install with the CLI, then browse the source below.
                  </DrawerDescription>
                  <figure
                    className="min-w-0 shrink-0"
                    data-rehype-pretty-code-figure
                  >
                    <Command
                      __bun__={`bunx --bun shadcn@latest add @audio/${name}`}
                      __npm__={`npx shadcn@latest add @audio/${name}`}
                      __pnpm__={`pnpm dlx shadcn@latest add @audio/${name}`}
                      __yarn__={`yarn dlx shadcn@latest add @audio/${name}`}
                    />
                  </figure>
                </DrawerHeader>
                <DrawerPanel
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                  scrollable={false}
                  scrollFade={false}
                >
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <Source
                      className="**:data-rehype-pretty-code-figure:no-scrollbar min-h-0 min-w-0 flex-1 overflow-hidden **:data-rehype-pretty-code-figure:mt-0 **:data-rehype-pretty-code-figure:flex **:data-rehype-pretty-code-figure:min-h-0 **:data-rehype-pretty-code-figure:flex-1 **:data-rehype-pretty-code-figure:flex-col **:data-rehype-pretty-code-figure:overflow-hidden"
                      collapsible={false}
                      copyButton={false}
                      fillHeight
                      headerActions={
                        <BlockCodeDrawerActions
                          code={block.files[0]?.content ?? ""}
                          name={name}
                        />
                      }
                      name={name}
                      pathLabel={block.files[0]?.path}
                    />
                  </div>
                </DrawerPanel>
              </div>
            </DrawerPopup>
          </Drawer>
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
