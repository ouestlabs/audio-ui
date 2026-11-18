import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/input-group border-input dark:bg-input/30 has-[:is([data-slot=input],[data-slot=textarea],[data-slot=combobox-input]):focus-visible]:border-ring has-[:is([data-slot=input],[data-slot=textarea],[data-slot=combobox-input]):focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-disabled:bg-input/50 dark:has-disabled:bg-input/80 h-8 rounded-lg border transition-colors in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-disabled:opacity-50 has-[:is([data-slot=input],[data-slot=textarea],[data-slot=combobox-input]):focus-visible]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5 relative flex w-full min-w-0 items-center outline-none has-[>textarea]:h-auto",
        className
      )}
      data-slot="input-group"
      role="group"
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground h-auto gap-2 py-1.5 text-sm font-medium group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4 flex cursor-text items-center justify-center select-none",
  {
    defaultVariants: {
      align: "inline-start",
    },
    variants: {
      align: {
        "block-end":
          "px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2 order-last w-full justify-start",
        "block-start":
          "px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2 order-first w-full justify-start",
        "inline-end":
          "pr-2 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem] order-last",
        "inline-start":
          "pl-2 has-[>button]:ml-[-0.3rem] has-[>kbd]:ml-[-0.15rem] order-first",
      },
    },
  }
);

// A press on an addon's text focuses the group's input, as on a label; its own buttons keep the press.
function focusGroupInput(event: MouseEvent<HTMLDivElement>) {
  if ((event.target as HTMLElement).closest("button")) {
    return;
  }
  event.preventDefault();
  event.currentTarget.parentElement?.querySelector("input")?.focus();
}

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      className={cn(inputGroupAddonVariants({ align }), className)}
      data-align={align}
      data-slot="input-group-addon"
      onMouseDown={focusGroupInput}
      role="group"
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "gap-2 text-sm flex items-center shadow-none",
  {
    defaultVariants: {
      size: "xs",
    },
    variants: {
      size: {
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
        "icon-xs":
          "size-6 rounded-[calc(var(--radius)-3px)] p-0 has-[>svg]:p-0",
        sm: "",
        xs: "h-6 gap-1 rounded-[calc(var(--radius)-3px)] px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
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
}: Omit<ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset";
  }) {
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

function InputGroupText({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground gap-2 text-sm [&_svg:not([class*='size-'])]:size-4 flex items-center [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <Input
      className={cn(
        "rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent flex-1",
        className
      )}
      data-slot="input-group-control"
      {...props}
    />
  );
}

function InputGroupTextarea({
  className,
  ...props
}: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      className={cn(
        "rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent flex-1 resize-none",
        className
      )}
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
