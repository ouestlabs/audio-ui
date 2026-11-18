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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

function Command({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "bg-popover text-popover-foreground rounded-xl! p-1 flex size-full flex-col overflow-hidden",
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
          "rounded-xl! top-1/3 translate-y-0 overflow-hidden p-0",
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
    <div className="p-1 pb-0" data-slot="command-input-wrapper">
      <InputGroup className="bg-input/30 border-input/30 h-8! rounded-lg! shadow-none! *:data-[slot=input-group-addon]:pl-2!">
        <CommandInputPrimitive
          className={cn(
            "w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <IconPlaceholder
            className="size-4 shrink-0 opacity-50"
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
        "no-scrollbar max-h-72 scroll-py-1 outline-none overflow-x-hidden overflow-y-auto",
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
      className={cn("py-6 text-center text-sm not-data-empty:py-0", className)}
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
        "text-foreground **:[[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:data-[slot=command-group-label]:px-2 **:data-[slot=command-group-label]:py-1.5 **:data-[slot=command-group-label]:font-medium **:data-[slot=command-group-label]:text-muted-foreground **:data-[slot=command-group-label]:text-xs",
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
      className={cn("bg-border -mx-1 h-px", className)}
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
        "data-selected:bg-muted data-selected:text-foreground data-selected:*:[svg]:text-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! [&_svg:not([class*='size-'])]:size-4 group/command-item data-highlighted:bg-muted data-highlighted:text-foreground data-highlighted:*:[svg]:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
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
        "text-muted-foreground group-data-selected/command-item:text-foreground ml-auto text-xs tracking-widest group-data-highlighted/command-item:text-foreground",
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
