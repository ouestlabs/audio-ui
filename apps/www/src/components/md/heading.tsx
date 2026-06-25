import type * as React from "react";
import { cn } from "@/registry/bases/base/lib/utils";

function H1({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn("mt-2 scroll-m-20 font-heading text-3xl", className)}
      {...props}
    />
  );
}

function H2({ className, children, ...props }: React.ComponentProps<"h2">) {
  const id =
    props?.id ||
    children
      ?.toString()
      .replace(/ /g, "-")
      .replace(/'/g, "")
      .replace(/\?/g, "")
      .toLowerCase();

  return (
    <h2
      {...props}
      className={cn(
        "mt-12 scroll-m-20 font-heading text-2xl first:mt-0 lg:mt-16 [&+p]:mt-4! *:[code]:text-2xl",
        className
      )}
      id={id}
    >
      <a
        className="no-underline underline-offset-4 hover:underline"
        href={`#${id}`}
      >
        {children}
      </a>
    </h2>
  );
}

function H3({ className, children, ...props }: React.ComponentProps<"h3">) {
  const id =
    props?.id ||
    children
      ?.toString()
      .replace(/ /g, "-")
      .replace(/'/g, "")
      .replace(/\?/g, "")
      .toLowerCase();

  return (
    <h3
      {...props}
      className={cn(
        "mt-8 scroll-m-20 font-semibold text-lg *:[code]:text-lg",
        className
      )}
      id={id}
    >
      <a
        className="no-underline underline-offset-4 hover:underline"
        href={`#${id}`}
      >
        {children}
      </a>
    </h3>
  );
}

function H4({ className, ...props }: React.ComponentProps<"h4">) {
  return (
    <h4
      className={cn("mt-8 scroll-m-20 font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function H5({ className, ...props }: React.ComponentProps<"h5">) {
  return (
    <h5
      className={cn(
        "mt-8 scroll-m-20 font-medium text-lg tracking-tight",
        className
      )}
      {...props}
    />
  );
}

function H6({ className, ...props }: React.ComponentProps<"h6">) {
  return (
    <h6
      className={cn(
        "mt-8 scroll-m-20 font-medium text-base tracking-tight",
        className
      )}
      {...props}
    />
  );
}

export { H1, H2, H3, H4, H5, H6 };
