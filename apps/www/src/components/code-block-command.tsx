"use client";

import { TerminalIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { CopyButton } from "@/components/copy-button";
import { Frame, FrameContent, FrameHeader } from "@/components/custom/frame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_CONFIG, useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";

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
  const mounted = useMounted();

  const packageManager = mounted
    ? (config.packageManager ?? DEFAULT_CONFIG.packageManager)
    : DEFAULT_CONFIG.packageManager;

  const tabs = React.useMemo(
    () => ({
      bun: __bun__,
      npm: __npm__,
      pnpm: __pnpm__,
      yarn: __yarn__,
    }),
    [__npm__, __pnpm__, __yarn__, __bun__]
  );

  const command = tabs[packageManager] ?? "";
  const handlePackageManagerChange = React.useCallback(
    (value: string) =>
      setConfig({
        ...config,
        packageManager: value as "pnpm" | "npm" | "yarn" | "bun",
      }),
    [config, setConfig]
  );

  return (
    <Tabs
      className="gap-0"
      onValueChange={handlePackageManagerChange}
      value={packageManager}
    >
      {/* The frame of the site: the package managers in its header, the command in its panel. */}
      <Frame className="not-typeset" data-code-command="">
        <FrameHeader className="min-h-11 flex-row items-center justify-between gap-3 px-2 py-1.5">
          <div className="flex items-center gap-2 ps-1">
            <TerminalIcon
              aria-hidden="true"
              className="size-4 text-site-muted-foreground"
              weight="fill"
            />
            <TabsList>
              {Object.entries(tabs).map(([key]) => (
                <TabsTrigger key={key} value={key}>
                  {key}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <CopyButton
            className="relative"
            event="copy_command"
            properties={{
              base: config.base,
              command,
              iconLibrary: config.iconLibrary,
              pm: packageManager,
              style: config.style,
            }}
            style={{ right: "auto", top: "auto" }}
            value={command}
            variant="outline"
          />
        </FrameHeader>
        <FrameContent className="no-scrollbar scroll-fade-x overflow-x-auto">
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
        </FrameContent>
      </Frame>
    </Tabs>
  );
}
