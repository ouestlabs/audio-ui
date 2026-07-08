"use client";

import Link from "next/link";
import * as React from "react";
import {
  serializeDesignSystemSearchParams,
  useDesignSystemSearchParams,
} from "@/app/(create)/lib/search-params";
import { CodeBlockCommand } from "@/components/code-block-command";
import { ComponentSourceClient } from "@/components/component-source-client";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useConfig } from "@/hooks/use-config";
import { siteConfig } from "@/lib/config";
import { getRegistryJsonAbsoluteUrl } from "@/lib/registry";

interface ComponentSourceSheetContentProps {
  base: string;
  name: string;
}

export function ComponentSourceSheetContent({
  name,
  base,
}: ComponentSourceSheetContentProps) {
  const [config] = useConfig();
  const [params] = useDesignSystemSearchParams();

  const styleName = `${base}-${config.style || "vega"}`;

  const v0Url = React.useMemo(() => {
    const registryUrl = new URL(
      getRegistryJsonAbsoluteUrl(
        process.env.NEXT_PUBLIC_APP_URL || siteConfig.url,
        styleName,
        name
      )
    );
    const paramsString = serializeDesignSystemSearchParams("", params);

    if (paramsString) {
      const designSystemParams = new URLSearchParams(paramsString.slice(1));

      for (const [key, value] of designSystemParams.entries()) {
        registryUrl.searchParams.set(key, value);
      }
    }

    return `https://v0.dev/chat/api/open?url=${encodeURIComponent(registryUrl.toString())}`;
  }, [styleName, name, params]);

  return (
    <SheetContent className="flex flex-col gap-0 bg-site-sidebar duration-200 data-ending-style:translate-x-8 data-starting-style:translate-x-8 data-ending-style:opacity-0 data-starting-style:opacity-0 sm:max-w-2xl! w-full! [&_button.ring-offset-site-background]:hidden">
      <SheetHeader>
        <SheetTitle>Installation</SheetTitle>
      </SheetHeader>
      <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6">
        <div className="site-rounded-lg relative border border-site-border">
          <CodeBlockCommand
            __bun__={`bunx --bun shadcn@latest add @audio/${name}`}
            __npm__={`npx shadcn@latest add @audio/${name}`}
            __pnpm__={`pnpm dlx shadcn@latest add @audio/${name}`}
            __yarn__={`yarn dlx shadcn@latest add @audio/${name}`}
          />
        </div>
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <h2 className="mt-6 mb-4 font-semibold text-base">Code</h2>
            <Button
              nativeButton={false}
              render={
                <Link href={v0Url} rel="noopener noreferrer" target="_blank">
                  Open in<span className="sr-only">v0</span>
                  <Icons.v0 className="ml-1 size-4" />
                </Link>
              }
              variant="outline"
            />
          </div>
          <div className="site-rounded-md relative flex-1 grow overflow-hidden border border-site-border bg-site-code">
            <ComponentSourceClient
              className="*:data-rehype-pretty-code-figure:no-scrollbar no-scrollbar *:data-rehype-pretty-code-figure:scroll-fade h-full overflow-auto *:data-rehype-pretty-code-figure:mt-0 *:data-rehype-pretty-code-figure:max-h-full *:data-rehype-pretty-code-figure:overflow-y-auto"
              collapsible={false}
              eventName="copy_component_code"
              iconLibrary={config.iconLibrary}
              name={name}
              styleName={styleName}
            />
          </div>
        </div>
      </div>
    </SheetContent>
  );
}
