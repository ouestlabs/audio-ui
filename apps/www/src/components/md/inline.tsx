import type * as React from "react";
import { CopyButton } from "@/components/copy-button";
import { Command } from "@/components/md/code";
import { getIconForLanguageExtension } from "@/lib/icons";
import { cn } from "@/registry/default/lib/utils";

function Pre({ className, children, ...props }: React.ComponentProps<"pre">) {
  return (
    <pre
      className={cn(
        "no-scrollbar min-w-0 overflow-x-auto px-4 py-3.5 text-[.8125rem] outline-none has-data-[slot=tabs]:p-0 has-data-line-numbers:p-0 has-data-highlighted-line:px-0",
        className
      )}
      {...props}
    >
      {children}
    </pre>
  );
}

function Figure({ className, ...props }: React.ComponentProps<"figure">) {
  return <figure className={cn(className)} {...props} />;
}

function Figcaption({
  className,
  children,
  ...props
}: React.ComponentProps<"figcaption">) {
  const iconExtension =
    "data-language" in props && typeof props["data-language"] === "string"
      ? getIconForLanguageExtension(props["data-language"])
      : null;

  return (
    <figcaption
      className={cn(
        "flex items-center gap-2 text-code-foreground [&_svg]:size-5 [&_svg]:text-code-foreground [&_svg]:opacity-70 sm:[&_svg]:size-4",
        className
      )}
      {...props}
    >
      {iconExtension}
      {children}
    </figcaption>
  );
}

function Code({
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
}) {
  if (typeof props.children === "string") {
    return (
      <code
        className={cn(
          "relative rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none",
          className
        )}
        {...props}
      />
    );
  }

  const isNpmCommand = __npm__ && __yarn__ && __pnpm__ && __bun__;
  if (isNpmCommand) {
    return (
      <Command
        __bun__={__bun__}
        __npm__={__npm__}
        __pnpm__={__pnpm__}
        __yarn__={__yarn__}
      />
    );
  }

  return (
    <>
      {__raw__ && <CopyButton src={__src__} value={__raw__} />}
      <code {...props} />
    </>
  );
}

export { Pre, Figure, Figcaption, Code };
