import type * as React from "react";
import {
  CodeFrame,
  CodeFrameHeader,
  Command,
  CopyButton,
} from "@/components/md/code";
import { cn } from "@/registry/default/lib/utils";

function Pre({ className, children, ...props }: React.ComponentProps<"pre">) {
  return (
    <pre
      className={cn("no-scrollbar min-w-0 overflow-x-auto", className)}
      {...props}
    >
      {children}
    </pre>
  );
}

function Figure({ className, ...props }: React.ComponentProps<"figure">) {
  return <CodeFrame className={cn(className)} {...props} />;
}

function Figcaption({
  className,
  children,
  ...props
}: React.ComponentProps<"figcaption">) {
  const iconExtension =
    "data-language" in props && typeof props["data-language"] === "string"
      ? props["data-language"]
      : null;

  return (
    <CodeFrameHeader
      className={cn(className)}
      compact
      language={iconExtension ?? "text"}
      title={children}
      {...props}
    />
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
      {__raw__ && (
        <CopyButton
          data-overlay
          tooltip="Copy to Clipboard"
          value={__raw__}
        />
      )}
      <code {...props} />
    </>
  );
}

export { Pre, Figure, Figcaption, Code };
