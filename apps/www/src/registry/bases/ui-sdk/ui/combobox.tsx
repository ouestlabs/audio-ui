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
import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry/bases/ui-sdk/hooks/use-popup-container";
import { Button } from "@/registry/bases/ui-sdk/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/registry/bases/ui-sdk/ui/input-group";

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
      className={cn("cn-combobox-trigger", className)}
      {...props}
    >
      {children}
      <IconPlaceholder
        className="cn-combobox-trigger-icon pointer-events-none"
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
        className="cn-input cn-input-group-input w-full min-w-0 flex-1 outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
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
              className="cn-combobox-trigger-icon pointer-events-none"
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
        "cn-combobox-content cn-combobox-content-logical cn-menu-translucent group/combobox-content max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) [--list-height:var(--available-height)]",
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
        "cn-combobox-list max-h-[min(calc(--spacing(72)-(--spacing(9))),calc(var(--list-height)-(--spacing(9))))] overflow-y-auto overscroll-contain",
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
        "cn-combobox-item relative flex w-full cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxItemIndicator className="cn-combobox-item-indicator">
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
      className={cn("cn-combobox-label", className)}
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
      className={cn("cn-combobox-empty data-empty:flex", className)}
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
      className={cn("cn-combobox-separator", className)}
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
      className={cn("cn-combobox-chips", className)}
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
        "cn-combobox-chip data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {showRemove ? (
        <ComboboxChipRemove
          aria-label="Remove"
          className="cn-combobox-chip-remove"
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
