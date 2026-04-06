import { InfoIcon } from "lucide-react";
import React from "react";
import type { registryItemSchema } from "shadcn/schema";
import type { z } from "zod";
import { CopyRegistry } from "@/components/copy-registry";
import { Command } from "@/components/md/code";
import { Source } from "@/components/md/preview";
import { OpenInV0Button } from "@/components/open-in-v0-button";
import { highlightCode } from "@/lib/highlight-code";
import { getRegistryItem } from "@/lib/registry";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/registry/default/ui/sheet";

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
        "relative flex min-w-0 flex-col rounded-xl border bg-muted/50",
        className
      )}
    >
      <div className="-m-px flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border bg-background p-5">
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
          <Sheet>
            <SheetTrigger asChild>
              <Button className="text-xs" size="sm" variant="outline">
                View code
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-sidebar duration-200 data-ending-style:translate-x-8 data-starting-style:translate-x-8 data-ending-style:opacity-0 data-starting-style:opacity-0 sm:max-w-3xl">
              <SheetTitle className="sr-only">View code</SheetTitle>
              <SheetDescription className="sr-only">
                View the code for the {name} block.
              </SheetDescription>
              <div className="flex flex-1 flex-col overflow-hidden p-6">
                <div>
                  <h2 className="mb-4 font-heading text-xl">Installation</h2>
                  <figure data-rehype-pretty-code-figure>
                    <Command
                      __bun__={`bunx --bun shadcn@latest add @audio/${name}`}
                      __npm__={`npx shadcn@latest add @audio/${name}`}
                      __pnpm__={`pnpm dlx shadcn@latest add @audio/${name}`}
                      __yarn__={`yarn dlx shadcn@latest add @audio/${name}`}
                    />
                  </figure>
                </div>
                <div className="flex h-full flex-1 flex-col overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="mt-6 mb-4 font-heading text-xl">Code</h2>
                    <OpenInV0Button name={name} />
                  </div>
                  <Source
                    className="*:data-rehype-pretty-code-figure:no-scrollbar h-full overflow-hidden *:data-rehype-pretty-code-figure:mt-0 *:data-rehype-pretty-code-figure:max-h-full *:data-rehype-pretty-code-figure:overflow-y-auto"
                    collapsible={false}
                    name={name}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
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
