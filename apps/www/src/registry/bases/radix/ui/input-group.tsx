"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/registry/bases/radix/lib/utils";
import { Button } from "@/registry/bases/radix/ui/button";
import { Input } from "@/registry/bases/radix/ui/input";
import { Textarea } from "@/registry/bases/radix/ui/textarea";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/input-group cn-input-group relative flex w-full min-w-0 items-center outline-none has-[>textarea]:h-auto",
        className
      )}
      data-slot="input-group"
      role="group"
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "cn-input-group-addon flex cursor-text items-center justify-center select-none",
  {
    defaultVariants: {
      align: "inline-start",
    },
    variants: {
      align: {
        "block-end":
          "cn-input-group-addon-align-block-end order-last w-full justify-start",
        "block-start":
          "cn-input-group-addon-align-block-start order-first w-full justify-start",
        "inline-end": "cn-input-group-addon-align-inline-end order-last",
        "inline-start": "cn-input-group-addon-align-inline-start order-first",
      },
    },
  }
);

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      className={cn(inputGroupAddonVariants({ align }), className)}
      data-align={align}
      data-slot="input-group-addon"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      role="group"
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "cn-input-group-button flex items-center shadow-none",
  {
    defaultVariants: {
      size: "xs",
    },
    variants: {
      size: {
        "icon-sm": "cn-input-group-button-size-icon-sm",
        "icon-xs": "cn-input-group-button-size-icon-xs",
        sm: "cn-input-group-button-size-sm",
        xs: "cn-input-group-button-size-xs",
      },
    },
  }
);

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      className={cn(inputGroupButtonVariants({ size }), className)}
      data-size={size}
      type={type}
      variant={variant}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "cn-input-group-text flex items-center [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  );
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      className={cn("cn-input-group-input flex-1", className)}
      data-slot="input-group-control"
      {...props}
    />
  );
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      className={cn("cn-input-group-textarea flex-1 resize-none", className)}
      data-slot="input-group-control"
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};
