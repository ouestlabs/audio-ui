"use client";

import { CheckIcon, CopyIcon, TerminalIcon } from "@phosphor-icons/react";
import React from "react";
import { useConfig } from "@/hooks/use-config";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import {
  CollapsibleContent,
  CollapsibleTrigger,
  Collapsible as UICollapsible,
} from "@/registry/default/ui/collapsible";
import { ScrollArea } from "@/registry/default/ui/scroll-area";
import { Separator } from "@/registry/default/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/registry/default/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/default/ui/tooltip";

// Collapsible
function Collapse({
  className,
  children,
  ...props
}: React.ComponentProps<typeof UICollapsible>) {
  const [isOpened, setIsOpened] = React.useState(false);

  return (
    <UICollapsible
      className={cn("group/collapsible md:-mx-1 relative", className)}
      onOpenChange={setIsOpened}
      open={isOpened}
      {...props}
    >
      <div className="absolute top-1.5 right-10 z-10 flex items-center">
        <CollapsibleTrigger
          render={
            <Button
              className="text-muted-foreground"
              size="sm"
              variant="ghost"
            />
          }
        >
          {isOpened ? "Collapse" : "Expand"}
        </CollapsibleTrigger>
        <Separator className="mx-1.5" orientation="vertical" />
      </div>
      <CollapsibleContent
        className="relative mt-6 h-full overflow-hidden data-closed:max-h-64 [&>figure]:mt-0 [&>figure]:md:mx-0!"
        hidden={false}
        keepMounted
      >
        {children}
      </CollapsibleContent>
      <CollapsibleTrigger className="-bottom-2 absolute inset-x-0 flex h-20 cursor-pointer items-center justify-center rounded-b-lg bg-gradient-to-b from-transparent via-50% via-background to-background font-medium text-muted-foreground text-sm transition-colors hover:text-foreground group-data-open/collapsible:hidden">
        {isOpened ? "Collapse" : "Expand"}
      </CollapsibleTrigger>
    </UICollapsible>
  );
}

// Command
function Command({
  __npm__,
  __yarn__,
  __pnpm__,
  __bun__,
}: React.ComponentProps<"pre"> & {
  __npm__?: string;
  __yarn__?: string;
  __pnpm__?: string;
  __bun__?: string;
}) {
  const [config, setConfig] = useConfig();
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  const packageManager = config?.packageManager || "bun";
  const tabs = React.useMemo(
    () => ({
      pnpm: __pnpm__,
      npm: __npm__,
      yarn: __yarn__,
      bun: __bun__,
    }),
    [__npm__, __pnpm__, __yarn__, __bun__]
  );

  const copyCommand = React.useCallback(() => {
    const command = tabs[packageManager];

    if (!command) {
      return;
    }

    copyToClipboard(command);
  }, [packageManager, tabs, copyToClipboard]);

  return (
    <div className="overflow-x-auto">
      <Tabs
        onValueChange={(value) => {
          setConfig({
            ...config,
            packageManager: value as typeof packageManager,
          });
        }}
        value={packageManager}
      >
        <div className="flex items-center gap-4 border-b px-4 py-1 font-mono">
          <TerminalIcon weight="duotone" />
          <TabsList>
            {Object.entries(tabs).map(([key]) => (
              <TabsTrigger key={key} value={key}>
                {key}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="no-scrollbar overflow-x-auto">
          {Object.entries(tabs).map(([key, value]) => (
            <TabsContent className="p-4" key={key} value={key}>
              <ScrollArea>
                <pre>
                  <code
                    className="relative font-mono text-[.8125rem] leading-none"
                    data-language="bash"
                  >
                    {value}
                  </code>
                </pre>
              </ScrollArea>
            </TabsContent>
          ))}
        </div>
      </Tabs>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="absolute top-1 right-1 z-3"
              data-slot="copy-button"
              onClick={copyCommand}
              size="icon"
              variant="ghost"
            />
          }
        >
          <span className="sr-only">Copy</span>
          {isCopied ? <CheckIcon /> : <CopyIcon />}
        </TooltipTrigger>
        <TooltipContent>
          {isCopied ? "Copied" : "Copy to Clipboard"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// Tabs
function CodeTabs({ children }: React.ComponentProps<typeof Tabs>) {
  const [config, setConfig] = useConfig();

  const installationType = React.useMemo(
    () => config.installationType || "cli",
    [config]
  );

  return (
    <Tabs
      className="relative mt-6 w-full"
      onValueChange={(value) =>
        setConfig({ ...config, installationType: value })
      }
      value={installationType}
    >
      {children}
    </Tabs>
  );
}

export { Collapse, Command, CodeTabs };
