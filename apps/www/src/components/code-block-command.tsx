"use client";

import { TerminalIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { CopyButton } from "@/components/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_CONFIG, useConfig } from "@/hooks/use-config";

export function CodeBlockCommand({
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
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const packageManager = mounted
    ? (config.packageManager ?? DEFAULT_CONFIG.packageManager)
    : DEFAULT_CONFIG.packageManager;

  const tabs = React.useMemo(
    () => ({
      pnpm: __pnpm__,
      npm: __npm__,
      yarn: __yarn__,
      bun: __bun__,
    }),
    [__npm__, __pnpm__, __yarn__, __bun__]
  );

  const command = tabs[packageManager] ?? "";

  return (
    <div className="overflow-x-auto">
      <Tabs
        className="gap-0"
        onValueChange={(value) => {
          setConfig({
            ...config,
            packageManager: value as "pnpm" | "npm" | "yarn" | "bun",
          });
        }}
        value={packageManager}
      >
        <div className="flex items-center justify-between gap-2 border-site-border/50 border-b px-3 py-1">
          <div className="flex items-center gap-2">
            <div className="flex size-4 items-center justify-center rounded-[1px] opacity-70">
              <TerminalIcon className="text-site-foreground" weight="duotone" />
            </div>
            <TabsList>
              {Object.entries(tabs).map(([key]) => (
                <TabsTrigger key={key} value={key}>
                  {key}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
        <div className="no-scrollbar scroll-fade-x overflow-x-auto">
          {Object.entries(tabs).map(([key, value]) => (
            <TabsContent className="mt-0 px-4 py-3.5" key={key} value={key}>
              <pre>
                <code
                  className="relative mr-4 font-mono text-sm leading-none"
                  data-language="bash"
                >
                  {value}
                </code>
              </pre>
            </TabsContent>
          ))}
        </div>
      </Tabs>
      <CopyButton
        className="top-1 right-1 bg-transparent opacity-70"
        event="copy_command"
        properties={{
          command,
          pm: packageManager,
          base: config.base,
          style: config.style,
          iconLibrary: config.iconLibrary,
        }}
        value={command}
      />
    </div>
  );
}
