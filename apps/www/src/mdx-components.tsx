import { Link } from "@tanstack/react-router";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type * as React from "react";
import { CodeBlockCommand } from "@/components/code/block/code-block-command";
import { CodeCollapsibleWrapper } from "@/components/code/block/code-collapsible-wrapper";
import { CodeTabs } from "@/components/code/block/code-tabs";
import { CopyButton } from "@/components/code/copy/copy-button";
import { DocsComponentSource } from "@/components/code/source/docs-component-source";
import { Callout } from "@/components/docs/mdx/callout";
import { DemoSounds } from "@/components/docs/mdx/demo-sounds";
import { DeviceUsage } from "@/components/docs/mdx/device-usage";
import { IconCatalog } from "@/components/docs/mdx/icon-catalog";
import { Install, InstallAgentParts } from "@/components/docs/mdx/install";
import { Mermaid } from "@/components/docs/mdx/mermaid";
import {
  KeyRow,
  KeyTable,
  TypeRow,
  TypeTable,
} from "@/components/docs/mdx/type-table";
import { DocsComponentPreview } from "@/components/preview/component/docs-component-preview";
import {
  Control,
  DeviceControls,
} from "@/components/preview/controls/device-controls";
import { getIconForLanguageExtension, Icons } from "@/components/site/icons";
import { Frame, FrameContent } from "@/components/site/layout/frame";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InstallProps } from "@/lib/docs/content/install-docs";
import { cn } from "@/lib/utils";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  const mdx: MDXComponents = {
    ...defaultMdxComponents,
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    Alert,
    AlertDescription,
    AlertTitle,
    AspectRatio,
    Button,
    Callout,
    Control,
    DemoSounds,
    DeviceControls,
    DeviceUsage,
    IconCatalog,
    CodeBlockCommand,
    InstallAgent: InstallAgentParts,
    CodeCollapsibleWrapper,
    CodeTabs,
    ComponentPreview: ({
      className,
      ...props
    }: React.ComponentProps<typeof DocsComponentPreview>) => (
      <DocsComponentPreview
        className={cn("not-typeset", className)}
        {...props}
      />
    ),
    ComponentSource: ({
      className,
      ...props
    }: React.ComponentProps<typeof DocsComponentSource>) => (
      <DocsComponentSource
        className={cn("not-typeset", className)}
        {...props}
      />
    ),
    code: ({
      className,
      __raw__,
      __src__,
      __npm__,
      __yarn__,
      __pnpm__,
      __bun__,
      ...props
    }: React.ComponentProps<"code"> & {
      __raw__?: string;
      __src__?: string;
      __npm__?: string;
      __yarn__?: string;
      __pnpm__?: string;
      __bun__?: string;
    }) => {
      // Inline code: a fence always carries its source in `__raw__`.
      if (typeof props.children === "string" && !__raw__) {
        return <code className={className} {...props} />;
      }

      // npm command.
      const isNpmCommand = __npm__ && __yarn__ && __pnpm__ && __bun__;

      if (isNpmCommand) {
        return (
          <CodeBlockCommand
            __bun__={__bun__}
            __npm__={__npm__}
            __pnpm__={__pnpm__}
            __yarn__={__yarn__}
          />
        );
      }

      // Default codeblock.
      return (
        <>
          {__raw__ ? <CopyButton src={__src__} value={__raw__} /> : null}
          <code {...props} />
        </>
      );
    },
    figcaption: ({
      className,
      children,
      ...props
    }: React.ComponentProps<"figcaption">) => {
      const iconExtension =
        "data-language" in props && typeof props["data-language"] === "string"
          ? getIconForLanguageExtension(props["data-language"])
          : null;

      return (
        <figcaption
          className={cn(
            "flex items-center gap-2 text-site-code-foreground [&_svg]:size-4 [&_svg]:text-site-code-foreground [&_svg]:opacity-70",
            className
          )}
          {...props}
        >
          {iconExtension}
          {children}
        </figcaption>
      );
    },
    figure: ({ className, ...props }: React.ComponentProps<"figure">) => (
      <figure className={cn(className)} data-not-typeset="" {...props} />
    ),
    h1: (props: React.ComponentProps<"h1">) => <h1 {...props} />,
    h2: (props: React.ComponentProps<"h2">) => <h2 {...props} />,
    h3: (props: React.ComponentProps<"h3">) => <h3 {...props} />,
    h4: (props: React.ComponentProps<"h4">) => <h4 {...props} />,
    h5: (props: React.ComponentProps<"h5">) => <h5 {...props} />,
    h6: (props: React.ComponentProps<"h6">) => <h6 {...props} />,
    Icons,
    Image: ({
      src,
      className,
      width,
      height,
      alt,
      ...props
    }: React.ComponentProps<"img">) => (
      <img
        alt={alt || ""}
        className={cn(
          "site-rounded-md mt-6 border border-site-border",
          className
        )}
        height={height ? Number(height) : undefined}
        loading="lazy"
        src={typeof src === "string" ? src : ""}
        width={width ? Number(width) : undefined}
        {...props}
      />
    ),
    img: ({ className, alt, ...props }: React.ComponentProps<"img">) => (
      // biome-ignore lint/correctness/useImageSize: <ignore>
      <img alt={alt} className={cn("site-rounded-md", className)} {...props} />
    ),
    Kbd,
    KeyRow,
    KeyTable,
    Link,
    LinkedCard: ({
      className,
      ...props
    }: React.ComponentProps<typeof Link>) => (
      <Link
        className={cn(
          "site-rounded-xl flex w-full flex-col items-center bg-site-surface p-6 text-site-surface-foreground transition-colors hover:bg-site-surface/80 sm:p-10",
          className
        )}
        {...props}
      />
    ),
    Mermaid,
    pre: ({ className, children, ...props }: React.ComponentProps<"pre">) => (
      <pre
        className={cn(
          "scrollbar-y min-w-0 overflow-x-auto px-4 py-3.5 outline-none has-data-[slot=tabs]:p-0",
          className
        )}
        {...props}
      >
        {children}
      </pre>
    ),
    Step: ({ className, ...props }: React.ComponentProps<"h3">) => (
      <h3
        className={cn(
          "mt-8 scroll-m-32 font-medium font-site-heading text-lg tracking-tight",
          className
        )}
        {...props}
      />
    ),
    Steps: ({ className, ...props }: React.ComponentProps<"div">) => (
      <div
        className={cn(
          "[&>h3]:step steps mb-12 [counter-reset:step] md:ml-4 md:border-l md:pl-8",
          className
        )}
        {...props}
      />
    ),
    Tab: ({ className, ...props }: React.ComponentProps<"div">) => (
      <div className={cn(className)} {...props} />
    ),
    Tabs: ({ className, ...props }: React.ComponentProps<typeof Tabs>) => (
      <Tabs className={cn("relative mt-6 w-full", className)} {...props} />
    ),
    TabsContent: ({
      className,
      ...props
    }: React.ComponentProps<typeof TabsContent>) => (
      <TabsContent
        className={cn(
          "relative [&>.steps]:mt-6 [&_h3.font-site-heading]:font-medium [&_h3.font-site-heading]:text-base *:[figure]:first:mt-0",
          className
        )}
        {...props}
      />
    ),
    TabsList: ({
      className,
      ...props
    }: React.ComponentProps<typeof TabsList>) => <TabsList {...props} />,
    TabsTrigger: ({
      className,
      ...props
    }: React.ComponentProps<typeof TabsTrigger>) => <TabsTrigger {...props} />,
    TypeRow,
    TypeTable,
    table: ({ className, ...props }: React.ComponentProps<"table">) => (
      <Frame className="my-6">
        <FrameContent className="typeset-scroll no-scrollbar mt-0">
          <table
            className={cn(
              "[&_:is(th,td):first-child]:ps-4 [&_:is(th,td):last-child]:pe-4",
              className
            )}
            {...props}
          />
        </FrameContent>
      </Frame>
    ),
    ...components,
    a: ({ href = "", ...props }: React.ComponentProps<"a">) =>
      // An address on the site is a route; anything else (a hash, another site, a file) is a plain link.
      href.startsWith("/") && !href.startsWith("//") ? (
        <Link to={href} {...(props as object)} />
      ) : (
        <a href={href} {...props} />
      ),
  };
  // The Installation section is drawn with the page's own steps and tabs.
  mdx.Install = (props: InstallProps) => (
    <Install
      Step={mdx.Step as never}
      Steps={mdx.Steps as never}
      TabsContent={mdx.TabsContent as never}
      {...props}
    />
  );
  return mdx;
}

export const mdxComponents = getMDXComponents();
