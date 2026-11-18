import {
  mergeProps,
  type RenderProp,
  renderElement,
} from "@ui-sdk/react/primitive";
import { CaretRightIcon, DotsThreeIcon } from "@phosphor-icons/react";
import { cn } from "cn";
import type * as React from "react";

/** What a part's state says, as the data attributes the styles read: `slot` is `data-slot`. */
function part(
  tag: string,
  defaults: Record<string, unknown>,
  props: Record<string, unknown>,
  render: RenderProp | undefined,
  state: Record<string, unknown>
) {
  const data = Object.fromEntries(
    Object.entries(state)
      .filter(([, value]) => value !== false && value !== null && value !== undefined)
      .map(([key, value]) => [`data-${key}`, value === true ? "" : value])
  );
  return renderElement(tag, mergeProps(defaults, data, props), render, state);
}

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="breadcrumb"
      className={cn(className)}
      data-slot="breadcrumb"
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground",
        className
      )}
      data-slot="breadcrumb-list"
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="breadcrumb-item"
      {...props}
    />
  );
}

function BreadcrumbLink({
  className,
  render,
  ...props
}: React.ComponentProps<"a"> & { render?: RenderProp }) {
  return part(
    "a",
      {
        className: cn("transition-colors hover:text-foreground", className),
      },
    props,
    render,
    {
      slot: "breadcrumb-link",
    }
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      data-slot="breadcrumb-page"
      {...props}
    />
  );
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      data-slot="breadcrumb-separator"
      role="presentation"
      {...props}
    >
      {children ?? <CaretRightIcon />}
    </li>
  );
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 items-center justify-center [&>svg]:size-4",
        className
      )}
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      {...props}
    >
      <DotsThreeIcon />
      <span className="sr-only">More</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
