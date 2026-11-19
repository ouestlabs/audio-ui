import {
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroupLabel,
  CommandGroup as CommandGroupPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandList as CommandListPrimitive,
  Command as CommandPrimitive,
  CommandSeparator as CommandSeparatorPrimitive,
  CommandShortcut as CommandShortcutPrimitive,
} from "@ui-sdk/react/command";
import type { ComponentProps, ReactNode } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/registry/bases/ui-sdk/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
} from "@/registry/bases/ui-sdk/ui/input-group";

function Command({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "cn-command flex size-full flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "cn-command-dialog top-1/3 translate-y-0 overflow-hidden p-0",
          className
        )}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandInputPrimitive>) {
  return (
    <div className="cn-command-input-wrapper" data-slot="command-input-wrapper">
      <InputGroup className="cn-command-input-group">
        <CommandInputPrimitive
          className={cn(
            "cn-command-input outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <IconPlaceholder
            className="cn-command-input-icon"
            hugeicons="SearchIcon"
            lucide="SearchIcon"
            phosphor="MagnifyingGlassIcon"
            remixicon="RiSearchLine"
            tabler="IconSearch"
          />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function CommandList({
  className,
  ...props
}: ComponentProps<typeof CommandListPrimitive>) {
  return (
    <CommandListPrimitive
      className={cn(
        "cn-command-list overflow-x-hidden overflow-y-auto",
        className
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandEmptyPrimitive>) {
  return (
    <CommandEmptyPrimitive
      className={cn("cn-command-empty not-data-empty:py-0", className)}
      {...props}
    />
  );
}

// The `heading` of a group is its label, as in the shadcn API.
function CommandGroup({
  className,
  heading,
  children,
  ...props
}: Omit<ComponentProps<typeof CommandGroupPrimitive>, "children"> & {
  children?: ReactNode;
  heading?: ReactNode;
}) {
  return (
    <CommandGroupPrimitive
      className={cn(
        "cn-command-group **:data-[slot=command-group-label]:px-2 **:data-[slot=command-group-label]:py-1.5 **:data-[slot=command-group-label]:font-medium **:data-[slot=command-group-label]:text-muted-foreground **:data-[slot=command-group-label]:text-xs",
        className
      )}
      {...props}
    >
      {heading ? <CommandGroupLabel>{heading}</CommandGroupLabel> : null}
      {children}
    </CommandGroupPrimitive>
  );
}

function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandSeparatorPrimitive>) {
  return (
    <CommandSeparatorPrimitive
      className={cn("cn-command-separator", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: ComponentProps<typeof CommandItemPrimitive>) {
  return (
    <CommandItemPrimitive
      className={cn(
        "cn-command-item group/command-item data-highlighted:bg-muted data-highlighted:text-foreground data-highlighted:*:[svg]:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: ComponentProps<typeof CommandShortcutPrimitive>) {
  return (
    <CommandShortcutPrimitive
      className={cn(
        "cn-command-shortcut group-data-highlighted/command-item:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
