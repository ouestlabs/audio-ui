import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import Image from "next/image";
import Link from "next/link.js";
import type * as React from "react";
import { Callout } from "@/components/callout";
import { CodeBlockCommand } from "@/components/code-block-command";
import { CodeCollapsibleWrapper } from "@/components/code-collapsible-wrapper";
import { CodeTabs } from "@/components/code-tabs";
import { CopyButton } from "@/components/copy-button";
import { DocsComponentPreview } from "@/components/docs-component-preview";
import { DocsComponentSource } from "@/components/docs-component-source";
import { getIconForLanguageExtension } from "@/components/icons";
import { Mermaid } from "@/components/mermaid";
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
import { cn } from "@/lib/utils";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
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
    CodeBlockCommand,
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
      // Inline Code.
      if (typeof props.children === "string") {
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
          {__raw__ && <CopyButton src={__src__} value={__raw__} />}
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
    Image: ({
      src,
      className,
      width,
      height,
      alt,
      ...props
    }: React.ComponentProps<"img">) => (
      <Image
        alt={alt || ""}
        className={cn(
          "site-rounded-md mt-6 border border-site-border",
          className
        )}
        height={height ? Number(height) : undefined}
        src={typeof src === "string" ? src : ""}
        width={width ? Number(width) : undefined}
        {...props}
      />
    ),
    img: ({ className, alt, ...props }: React.ComponentProps<"img">) => (
      // biome-ignore lint/correctness/useImageSize: <ignore>
      // biome-ignore lint/performance/noImgElement: <ignore>
      <img alt={alt} className={cn("site-rounded-md", className)} {...props} />
    ),
    Kbd,
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
          "no-scrollbar min-w-0 overflow-x-auto px-4 py-3.5 outline-none has-data-[slot=tabs]:p-0 has-data-highlighted-line:px-0 has-data-line-numbers:px-0",
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
    table: ({ className, ...props }: React.ComponentProps<"table">) => (
      <div className="typeset-scroll no-scrollbar">
        <table className={className} {...props} />
      </div>
    ),
    ...components,
    a: (props: any) => {
      const A = components?.a || Link;
      return <A {...props} />;
    },
  };
}

export const mdxComponents = getMDXComponents();
