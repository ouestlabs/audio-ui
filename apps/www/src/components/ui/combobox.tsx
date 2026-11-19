import {
  ComboboxChip as ComboboxChipPrimitive,
  ComboboxChipRemove,
  ComboboxChips as ComboboxChipsPrimitive,
  ComboboxClear as ComboboxClearPrimitive,
  ComboboxContent as ComboboxContentPrimitive,
  ComboboxEmpty as ComboboxEmptyPrimitive,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput as ComboboxInputPrimitive,
  ComboboxItemIndicator,
  ComboboxItem as ComboboxItemPrimitive,
  ComboboxList as ComboboxListPrimitive,
  Combobox as ComboboxPrimitive,
  type ComboboxProps,
  ComboboxSeparator as ComboboxSeparatorPrimitive,
  ComboboxTrigger as ComboboxTriggerPrimitive,
  ComboboxValue,
} from "@ui-sdk/react/combobox";
import type { ComponentProps, ReactNode } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { usePopupContainer } from "@/hooks/use-popup-container";
import { cn } from "@/lib/utils";

function Combobox<T = string, Multiple extends boolean | undefined = false>({
  container,
  ...props
}: ComboboxProps<T, Multiple>) {
  const popups = usePopupContainer();
  return (
    <ComboboxPrimitive<T, Multiple>
      {...({ ...props, container: container ?? popups } as ComboboxProps<
        T,
        Multiple
      >)}
    />
  );
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof ComboboxTriggerPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <ComboboxTriggerPrimitive
      className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {children}
      <IconPlaceholder
        className="text-muted-foreground size-4 pointer-events-none"
        hugeicons="ArrowDown01Icon"
        lucide="ChevronDownIcon"
        phosphor="CaretDownIcon"
        remixicon="RiArrowDownSLine"
        tabler="IconChevronDown"
      />
    </ComboboxTriggerPrimitive>
  );
}

function ComboboxClear(props: ComponentProps<typeof ComboboxClearPrimitive>) {
  return (
    <ComboboxClearPrimitive
      aria-label="Clear"
      render={<InputGroupButton size="icon-xs" variant="ghost" />}
      {...props}
    >
      <IconPlaceholder
        className="pointer-events-none"
        hugeicons="Cancel01Icon"
        lucide="XIcon"
        phosphor="XIcon"
        remixicon="RiCloseLine"
        tabler="IconX"
      />
    </ComboboxClearPrimitive>
  );
}

function ComboboxInput({
  className,
  children,
  showTrigger = true,
  showClear = false,
  ...props
}: ComponentProps<typeof ComboboxInputPrimitive> & {
  children?: ReactNode;
  showClear?: boolean;
  showTrigger?: boolean;
}) {
  return (
    <InputGroup className={cn("w-auto", className)}>
      <ComboboxInputPrimitive
        className="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm rounded-none border-0 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent w-full min-w-0 flex-1 outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger ? (
          <ComboboxTriggerPrimitive
            aria-label="Show options"
            className="group-has-data-[slot=combobox-clear]/input-group:hidden data-open:bg-transparent"
            render={<InputGroupButton size="icon-xs" variant="ghost" />}
          >
            <IconPlaceholder
              className="text-muted-foreground size-4 pointer-events-none"
              hugeicons="ArrowDown01Icon"
              lucide="ChevronDownIcon"
              phosphor="CaretDownIcon"
              remixicon="RiArrowDownSLine"
              tabler="IconChevronDown"
            />
          </ComboboxTriggerPrimitive>
        ) : null}
        {showClear ? <ComboboxClear /> : null}
      </InputGroupAddon>
      {children}
    </InputGroup>
  );
}

// The list scrolls within the room the popup has: ui-sdk's `--available-height` doesn't inherit, the copy does.
function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  ...props
}: ComponentProps<typeof ComboboxContentPrimitive>) {
  return (
    <ComboboxContentPrimitive
      align={align}
      alignOffset={alignOffset}
      className={cn(
        "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:border-input/30 max-h-72 min-w-36 overflow-hidden rounded-lg shadow-md ring-1 duration-100 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:shadow-none data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 animate-none! relative bg-popover/70 backdrop-blur-2xl backdrop-saturate-150 **:data-[slot$=-item]:focus:bg-foreground/10 **:data-[slot$=-item]:data-highlighted:bg-foreground/10 **:data-[slot$=-item]:focus:text-foreground **:data-[slot$=-item]:data-highlighted:text-foreground **:data-[slot$=-separator]:bg-foreground/5 **:data-[slot$=-trigger]:focus:bg-foreground/10 **:data-[slot$=-trigger]:focus:text-foreground **:data-[slot$=-trigger]:aria-expanded:text-foreground **:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! **:data-[variant=destructive]:focus:bg-foreground/10! **:data-[variant=destructive]:text-accent-foreground! **:data-[variant=destructive]:**:text-accent-foreground! group/combobox-content max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) [--list-height:var(--available-height)]",
        className
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function ComboboxList({
  className,
  ...props
}: ComponentProps<typeof ComboboxListPrimitive>) {
  return (
    <ComboboxListPrimitive
      className={cn(
        "no-scrollbar max-h-[min(calc(--spacing(72)-(--spacing(9))),calc(var(--available-height)-(--spacing(9))))] scroll-py-1 overflow-y-auto p-1 data-empty:p-0 max-h-[min(calc(--spacing(72)-(--spacing(9))),calc(var(--list-height)-(--spacing(9))))] overscroll-contain",
        className
      )}
      {...props}
    />
  );
}

function ComboboxItem({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof ComboboxItemPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <ComboboxItemPrimitive
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 relative flex w-full cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <IconPlaceholder
          className="pointer-events-none"
          hugeicons="Tick02Icon"
          lucide="CheckIcon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
          tabler="IconCheck"
        />
      </ComboboxItemIndicator>
    </ComboboxItemPrimitive>
  );
}

// The shadcn API's label names a group of items: the input's own label is a field's.
function ComboboxLabel({
  className,
  ...props
}: ComponentProps<typeof ComboboxGroupLabel>) {
  return (
    <ComboboxGroupLabel
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

function ComboboxEmpty({
  className,
  ...props
}: ComponentProps<typeof ComboboxEmptyPrimitive>) {
  return (
    <ComboboxEmptyPrimitive
      className={cn(
        "text-muted-foreground hidden w-full justify-center py-2 text-center text-sm group-data-empty/combobox-content:flex data-empty:flex",
        className
      )}
      {...props}
    />
  );
}

function ComboboxSeparator({
  className,
  ...props
}: ComponentProps<typeof ComboboxSeparatorPrimitive>) {
  return (
    <ComboboxSeparatorPrimitive
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function ComboboxChips({
  className,
  ...props
}: ComponentProps<typeof ComboboxChipsPrimitive>) {
  return (
    <ComboboxChipsPrimitive
      className={cn(
        "dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/50 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 has-aria-invalid:border-destructive dark:has-aria-invalid:border-destructive/50 flex min-h-8 flex-wrap items-center gap-1 rounded-lg border bg-transparent bg-clip-padding px-2.5 py-1 text-sm transition-colors focus-within:ring-3 has-aria-invalid:ring-3 has-data-[slot=combobox-chip]:px-1",
        className
      )}
      {...props}
    />
  );
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: Omit<ComponentProps<typeof ComboboxChipPrimitive>, "children"> & {
  children?: ReactNode;
  showRemove?: boolean;
}) {
  return (
    <ComboboxChipPrimitive
      className={cn(
        "bg-muted text-foreground flex h-[calc(--spacing(5.25))] w-fit items-center justify-center gap-1 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap has-data-[slot=combobox-chip-remove]:pr-0 data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {showRemove ? (
        <ComboboxChipRemove
          aria-label="Remove"
          className="-ml-1 opacity-50 hover:opacity-100"
          render={<Button size="icon-xs" variant="ghost" />}
        >
          <IconPlaceholder
            className="pointer-events-none"
            hugeicons="Cancel01Icon"
            lucide="XIcon"
            phosphor="XIcon"
            remixicon="RiCloseLine"
            tabler="IconX"
          />
        </ComboboxChipRemove>
      ) : null}
    </ComboboxChipPrimitive>
  );
}

function ComboboxChipsInput({
  className,
  ...props
}: ComponentProps<typeof ComboboxInputPrimitive>) {
  return (
    <ComboboxInputPrimitive
      className={cn("min-w-16 flex-1 outline-none", className)}
      {...props}
    />
  );
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
};
