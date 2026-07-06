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
    h1: ({ className, ...props }: React.ComponentProps<"h1">) => (
      <h1
        className={cn(
          "mt-2 scroll-m-28 font-bold font-site-heading text-3xl tracking-tight",
          className
        )}
        {...props}
      />
    ),
    h2: ({ className, ...props }: React.ComponentProps<"h2">) => (
      <h2
        className={cn(
          "mt-10 scroll-m-28 font-medium font-site-heading text-xl tracking-tight first:mt-0 lg:mt-16 [&+.steps>h3]:mt-4! [&+.steps]:mt-0! [&+h3]:mt-6! [&+p]:mt-4! [&+]*:[code]:text-xl",
          className
        )}
        id={props.children
          ?.toString()
          .replace(/ /g, "-")
          .replace(/'/g, "")
          .replace(/\?/g, "")
          .toLowerCase()}
        {...props}
      />
    ),
    h3: ({ className, ...props }: React.ComponentProps<"h3">) => (
      <h3
        className={cn(
          "mt-12 scroll-m-28 font-medium font-site-heading text-lg tracking-tight [&+p]:mt-4! *:[code]:text-xl",
          className
        )}
        {...props}
      />
    ),
    h4: ({ className, ...props }: React.ComponentProps<"h4">) => (
      <h4
        className={cn(
          "mt-8 scroll-m-28 font-medium font-site-heading text-base tracking-tight",
          className
        )}
        {...props}
      />
    ),
    h5: ({ className, ...props }: React.ComponentProps<"h5">) => (
      <h5
        className={cn(
          "mt-8 scroll-m-28 font-medium text-base tracking-tight",
          className
        )}
        {...props}
      />
    ),
    h6: ({ className, ...props }: React.ComponentProps<"h6">) => (
      <h6
        className={cn(
          "mt-8 scroll-m-28 font-medium text-base tracking-tight",
          className
        )}
        {...props}
      />
    ),
    p: ({ className, ...props }: React.ComponentProps<"p">) => (
      <p
        className={cn("not-first:mt-6 leading-relaxed", className)}
        {...props}
      />
    ),
    strong: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <strong className={cn("font-medium", className)} {...props} />
    ),
    ul: ({ className, ...props }: React.ComponentProps<"ul">) => (
      <ul className={cn("my-6 ml-6 list-disc", className)} {...props} />
    ),
    ol: ({ className, ...props }: React.ComponentProps<"ol">) => (
      <ol className={cn("my-6 ml-6 list-decimal", className)} {...props} />
    ),
    li: ({ className, ...props }: React.ComponentProps<"li">) => (
      <li className={cn("mt-2", className)} {...props} />
    ),
    blockquote: ({
      className,
      ...props
    }: React.ComponentProps<"blockquote">) => (
      <blockquote
        className={cn("mt-6 border-l-2 pl-6 italic", className)}
        {...props}
      />
    ),
    img: ({ className, alt, ...props }: React.ComponentProps<"img">) => (
      // biome-ignore lint/correctness/useImageSize: <ignore>
      // biome-ignore lint/performance/noImgElement: <ignore>
      <img alt={alt} className={cn("site-rounded-md", className)} {...props} />
    ),
    hr: ({ ...props }: React.ComponentProps<"hr">) => (
      <hr className="my-4 md:my-8" {...props} />
    ),
    table: ({ className, ...props }: React.ComponentProps<"table">) => (
      <div className="no-scrollbar site-rounded-lg my-6 w-full overflow-y-auto border border-site-border">
        <table
          className={cn(
            "relative w-full overflow-hidden border-none text-sm [&_tbody_tr:last-child]:border-b-0",
            className
          )}
          {...props}
        />
      </div>
    ),
    tr: ({ className, ...props }: React.ComponentProps<"tr">) => (
      <tr className={cn("m-0 border-b", className)} {...props} />
    ),
    th: ({ className, ...props }: React.ComponentProps<"th">) => (
      <th
        className={cn(
          "px-4 py-2 text-left font-bold [[align=center]]:text-center [[align=right]]:text-right",
          className
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }: React.ComponentProps<"td">) => (
      <td
        className={cn(
          "whitespace-nowrap px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right",
          className
        )}
        {...props}
      />
    ),
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
    figure: ({ className, ...props }: React.ComponentProps<"figure">) => (
      <figure className={cn(className)} {...props} />
    ),
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
        return (
          <code
            className={cn(
              "site-rounded-md wrap-break-word relative bg-site-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none",
              className
            )}
            {...props}
          />
        );
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
    Step: ({ className, ...props }: React.ComponentProps<"h3">) => (
      <h3
        className={cn(
          "mt-8 scroll-m-32 font-medium font-site-heading text-lg tracking-tight",
          className
        )}
        {...props}
      />
    ),
    CodeBlockCommand,
    Steps: ({ className, ...props }: React.ComponentProps<"div">) => (
      <div
        className={cn(
          "[&>h3]:step steps mb-12 [counter-reset:step] md:ml-4 md:border-l md:pl-8",
          className
        )}
        {...props}
      />
    ),
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
    Tabs: ({ className, ...props }: React.ComponentProps<typeof Tabs>) => (
      <Tabs className={cn("relative mt-6 w-full", className)} {...props} />
    ),
    TabsList: ({
      className,
      ...props
    }: React.ComponentProps<typeof TabsList>) => (
      <TabsList {...props} />
    ),
    TabsTrigger: ({
      className,
      ...props
    }: React.ComponentProps<typeof TabsTrigger>) => (
      <TabsTrigger {...props} />
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
    Tab: ({ className, ...props }: React.ComponentProps<"div">) => (
      <div className={cn(className)} {...props} />
    ),
    Button,
    Callout,
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    Alert,
    AlertTitle,
    AlertDescription,
    AspectRatio,
    CodeTabs,
    ComponentPreview: DocsComponentPreview,
    ComponentSource: DocsComponentSource,
    CodeCollapsibleWrapper,
    Mermaid,
    Link: ({ className, ...props }: React.ComponentProps<typeof Link>) => (
      <Link
        className={cn("font-medium underline underline-offset-4", className)}
        {...props}
      />
    ),
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
    Kbd,
    ...components,
    a: (props: any) => {
      const A = components?.a || Link;
      return (
        <A
          {...props}
          className={cn(
            "font-medium underline underline-offset-4",
            props.className
          )}
        />
      );
    },
  };
}

export const mdxComponents = getMDXComponents();
