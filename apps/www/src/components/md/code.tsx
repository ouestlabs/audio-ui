"use client";

import { CheckIcon, CopyIcon, TerminalIcon } from "@phosphor-icons/react";
import React from "react";
import { useConfig } from "@/hooks/use-config";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { getIconForLanguageExtension } from "@/lib/icons";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  CollapsibleContent,
  CollapsibleTrigger,
  Collapsible as UICollapsible,
} from "@/registry/bases/base/ui/collapsible";
import { Kbd, KbdGroup } from "@/registry/bases/base/ui/kbd";
import { ScrollArea } from "@/registry/bases/base/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/registry/bases/base/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/base/ui/tooltip";

function CodeFrame({ ...props }: React.ComponentProps<"figure">) {
  return <figure data-rehype-pretty-code-figure {...props} />;
}

type CodeFrameHeaderProps = Omit<
  React.ComponentProps<"figcaption">,
  "title"
> & {
  language: string;
  title?: React.ReactNode;
  pathLabel?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
};

function PathHeader({
  language,
  title,
  pathLabel,
  actions,
  icon,
  className,
  ...props
}: CodeFrameHeaderProps) {
  return (
    <figcaption
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 font-medium text-muted-foreground text-xs [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-foreground/70",
        className
      )}
      data-language={language}
      data-rehype-pretty-code-title
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {icon ?? getIconForLanguageExtension(language)}
        {pathLabel ? (
          <span className="truncate font-mono text-[0.8125rem] text-code-foreground">
            {pathLabel}
          </span>
        ) : null}
        {!pathLabel && title ? title : null}
      </span>
      {actions ? (
        <span className="flex shrink-0 items-center">{actions}</span>
      ) : null}
    </figcaption>
  );
}

function TitleHeader({
  language,
  title,
  icon,
  compact,
  className,
  ...props
}: CodeFrameHeaderProps) {
  return (
    <figcaption
      className={cn("flex items-center gap-3 text-code-foreground", className)}
      data-compact={compact || undefined}
      data-language={language}
      data-rehype-pretty-code-title
      {...props}
    >
      {icon ?? getIconForLanguageExtension(language)}
      {title}
    </figcaption>
  );
}

function CodeFrameHeader(props: CodeFrameHeaderProps) {
  const { title, pathLabel, actions } = props;
  if (!(title || pathLabel || actions)) {
    return null;
  }
  if (pathLabel || actions) {
    return <PathHeader {...props} />;
  }
  return <TitleHeader {...props} />;
}

function CodeFrameScroll({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollArea>) {
  return (
    <ScrollArea
      className={cn(
        "w-full bg-code **:data-[slot=scroll-area-viewport]:p-0",
        className
      )}
      {...props}
    >
      {children}
    </ScrollArea>
  );
}

type CopyButtonProps = {
  value?: string;
  copied?: boolean;
  onAction?: () => void;
  onCopied?: () => void;
  tooltip?: string | false;
  icon?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "onClick">;

function CopyButton({
  value,
  copied,
  onAction,
  onCopied,
  tooltip = false,
  className,
  icon,
  ...props
}: CopyButtonProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({
    onCopy: onCopied,
  });
  const hasCopied = copied ?? isCopied;
  const currentIcon = hasCopied ? <CheckIcon /> : (icon ?? <CopyIcon />);

  const button = (
    <Button
      aria-label={hasCopied ? "Copied" : "Copy to clipboard"}
      className={cn("cursor-pointer", className)}
      data-copied={hasCopied}
      data-slot="copy-button"
      onClick={() => {
        if (value) {
          copyToClipboard(value);
          return;
        }
        onAction?.();
      }}
      size="icon"
      title={hasCopied ? "Copied" : "Copy"}
      {...props}
    >
      <span className="sr-only">Copy</span>
      {currentIcon}
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>
        {hasCopied ? (
          "Copied"
        ) : (
          <KbdGroup>
            {tooltip}
            <Kbd>
              <CopyIcon />
            </Kbd>
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function Collapse({
  className,
  children,
  ...props
}: React.ComponentProps<typeof UICollapsible>) {
  const [isOpened, setIsOpened] = React.useState(false);

  return (
    <UICollapsible
      className={cn("group/collapsible md:-mx-1", className)}
      onOpenChange={setIsOpened}
      open={isOpened}
      {...props}
    >
      <CollapsibleContent
        className={cn(
          "mt-6 h-full p-px data-closed:max-h-64 [&>figure]:mt-0 [&>figure]:md:mx-0!",
          "data-closed:[-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_72%,transparent_100%)]",
          "data-closed:mask-[linear-gradient(to_bottom,black_0%,black_72%,transparent_100%)]"
        )}
        hidden={false}
        keepMounted
      >
        {children}
      </CollapsibleContent>
      <CollapsibleTrigger
        className="relative flex w-full items-end justify-center pb-2 text-muted-foreground transition-colors hover:text-foreground group-data-open/collapsible:hidden"
        render={
          <Button className="cursor-pointer bg-transparent!" variant="ghost" />
        }
      >
        Expand
      </CollapsibleTrigger>
    </UICollapsible>
  );
}

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
  const packageManager = config?.packageManager || "bun";
  const tabs = React.useMemo(
    () => ({ pnpm: __pnpm__, npm: __npm__, yarn: __yarn__, bun: __bun__ }),
    [__npm__, __pnpm__, __yarn__, __bun__]
  );

  return (
    <CodeFrame className="mt-0 overflow-hidden">
      <Tabs
        onValueChange={(value) =>
          setConfig({ ...config, packageManager: value })
        }
        value={packageManager}
      >
        <CodeFrameHeader
          actions={
            <CopyButton
              size="icon"
              value={tabs[packageManager] ?? ""}
              variant="ghost"
            />
          }
          icon={<TerminalIcon className="hidden sm:flex" weight="duotone" />}
          language="bash"
          title={
            <TabsList>
              {Object.entries(tabs).map(([key]) => (
                <TabsTrigger
                  className="text-xs sm:text-sm"
                  key={key}
                  value={key}
                >
                  {key}
                </TabsTrigger>
              ))}
            </TabsList>
          }
        />
        <div className="no-scrollbar overflow-x-auto">
          {Object.entries(tabs).map(([key, value]) => (
            <TabsContent key={key} value={key}>
              <CodeFrameScroll>
                <pre className="px-4 pt-1.5 pb-4">
                  <code
                    className="relative pr-4 font-mono text-[.8125rem] leading-none"
                    data-language="bash"
                  >
                    {value}
                  </code>
                </pre>
              </CodeFrameScroll>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </CodeFrame>
  );
}

function CodeTabs(props: React.ComponentProps<typeof Tabs>) {
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
      {...props}
    />
  );
}

export {
  Collapse,
  Command,
  CodeTabs,
  CodeFrame,
  CodeFrameHeader,
  CodeFrameScroll,
  CopyButton,
};
