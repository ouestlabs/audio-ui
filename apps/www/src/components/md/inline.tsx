import type * as React from "react";
import { CodeFrame, CodeFrameHeader, CopyButton } from "@/components/md/code";
import { cn } from "@/registry/bases/base/lib/utils";

function Figure({ className, ...props }: React.ComponentProps<"figure">) {
  return <CodeFrame className={cn(className)} {...props} />;
}

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

function Figcaption({
  className,
  children,
  ...props
}: React.ComponentProps<"figcaption">) {
  const language =
    "data-language" in props && typeof props["data-language"] === "string"
      ? props["data-language"]
      : "text";

  const isFilePath = typeof children === "string" && children.includes(".");

  return (
    <CodeFrameHeader
      className={cn(className)}
      language={language}
      pathLabel={isFilePath ? children : undefined}
      title={isFilePath ? undefined : children}
      {...props}
    />
  );
}

function Code({
  className,
  __raw__,
  ...props
}: React.ComponentProps<"code"> & {
  __raw__?: string;
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

  return (
    <>
      {__raw__ && (
        <CopyButton
          data-overlay
          size="icon-sm"
          value={__raw__}
          variant="outline"
        />
      )}
      <code {...props} />
    </>
  );
}

export { Pre, Figure, Figcaption, Code };
