import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useId,
} from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry/bases/ui-sdk/hooks/use-popup-container";

/** Which side a picker's menu opens on: a panel against the right edge opens them leftwards. */
const PickerSideContext = createContext<"left" | "right">("right");

/** The side for a picker's menu: above its anchor on small screens, else the surrounding panel's. */
function usePickerSide(isMobile: boolean) {
  const side = use(PickerSideContext);
  return isMobile ? "top" : side;
}

function Picker({ container, ...props }: ComponentProps<typeof Menu>) {
  const popups = usePopupContainer();
  return <Menu container={container ?? popups} modal="pointer" {...props} />;
}

function PickerTrigger({
  className,
  ...props
}: ComponentProps<typeof MenuTrigger>) {
  return (
    <MenuTrigger
      className={cn(
        "site-rounded-xl md:site-rounded-lg in-data-[slot=sheet-content]:site-rounded-lg relative w-[160px] shrink-0 touch-manipulation select-none border border-site-foreground/10 bg-site-muted/50 p-2 font-site-sans hover:bg-site-muted disabled:opacity-50 data-open:bg-site-muted md:w-full in-data-[slot=sheet-content]:w-full md:border-transparent in-data-[slot=sheet-content]:border-transparent md:bg-transparent in-data-[slot=sheet-content]:bg-transparent",
        className
      )}
      {...props}
    />
  );
}

function PickerContent({
  align = "start",
  alignOffset = 0,
  anchor,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: Omit<ComponentProps<typeof MenuContent>, "anchor"> & {
  anchor?: RefObject<HTMLElement | null>;
}) {
  return (
    <MenuContent
      align={align}
      alignOffset={alignOffset}
      anchor={
        anchor && {
          getBoundingClientRect: () =>
            anchor.current?.getBoundingClientRect() ?? new DOMRect(),
        }
      }
      className={cn(
        "data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 cn-menu-target no-scrollbar site-rounded-xl z-50 max-h-(--available-height) w-[calc(var(--anchor-width)-(--spacing(3.5)))] min-w-32 origin-(--transform-origin) overflow-y-auto overflow-x-hidden border-0 bg-site-popover p-1 font-site-sans text-site-popover-foreground shadow-md outline-none ring-1 ring-site-foreground/10 duration-100 data-closed:animate-out data-open:animate-in data-closed:overflow-hidden md:w-52",
        className
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

const PickerGroup = MenuGroup;

function PickerLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof MenuGroupLabel> & {
  inset?: boolean;
}) {
  return (
    <MenuGroupLabel
      className={cn(
        "px-2 py-1.5 font-medium text-site-muted-foreground text-xs data-inset:pl-8",
        className
      )}
      data-inset={inset}
      {...props}
    />
  );
}

function PickerItem({
  className,
  closeOnClick,
  inset,
  variant = "default",
  ...props
}: ComponentProps<typeof MenuItem> & {
  closeOnClick?: boolean;
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <MenuItem
      className={cn(
        "group/dropdown-menu-item site-rounded-sm relative flex cursor-default select-none items-center gap-2 px-2 pointer-coarse:py-2.5 py-1.5 pointer-coarse:pl-3 pointer-coarse:text-base text-sm outline-hidden focus:bg-site-accent focus:text-site-accent-foreground not-data-[variant=destructive]:focus:**:text-site-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-[variant=destructive]:text-site-destructive data-disabled:opacity-50 data-[variant=destructive]:focus:bg-site-destructive/10 data-[variant=destructive]:focus:text-site-destructive dark:data-[variant=destructive]:focus:bg-site-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[variant=destructive]:*:[svg]:text-site-destructive",
        className
      )}
      closeOnSelect={closeOnClick}
      data-inset={inset}
      data-variant={variant}
      {...props}
    />
  );
}

const PickerSub = MenuSub;

function PickerSubTrigger({
  className,
  inset,
  children,
  ...props
}: Omit<ComponentProps<typeof MenuSubTrigger>, "children"> & {
  children?: ReactNode;
} & {
  inset?: boolean;
}) {
  return (
    <MenuSubTrigger
      className={cn(
        "site-rounded-sm flex cursor-default select-none items-center gap-2 px-2 py-1.5 text-sm outline-hidden focus:bg-site-accent focus:text-site-accent-foreground not-data-[variant=destructive]:focus:**:text-site-accent-foreground data-open:bg-site-accent data-inset:pl-8 data-open:text-site-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      {...props}
    >
      {children}
      <IconPlaceholder
        className="ml-auto"
        hugeicons="ArrowRight01Icon"
        lucide="ChevronRightIcon"
        phosphor="CaretRightIcon"
        remixicon="RiArrowRightSLine"
        tabler="IconChevronRight"
      />
    </MenuSubTrigger>
  );
}

function PickerSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: ComponentProps<typeof MenuSubContent>) {
  return (
    <MenuSubContent
      align={align}
      alignOffset={alignOffset}
      className={cn(
        "data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 site-rounded-md w-auto min-w-[96px] bg-site-popover p-1 font-site-sans text-site-popover-foreground shadow-lg ring-1 ring-site-foreground/10 duration-100 data-closed:animate-out data-open:animate-in",
        className
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function PickerCheckboxItem({
  className,
  children,
  checked,
  value,
  ...props
}: Omit<ComponentProps<typeof MenuCheckboxItem>, "children" | "value"> & {
  children?: ReactNode;
  value?: string;
}) {
  const id = useId();
  return (
    <MenuCheckboxItem
      checked={checked}
      className={cn(
        "site-rounded-sm relative flex cursor-default select-none items-center gap-2 py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-site-accent focus:text-site-accent-foreground focus:**:text-site-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      value={value ?? id}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <MenuItemIndicator>
          <IconPlaceholder
            hugeicons="Tick02Icon"
            lucide="CheckIcon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
            tabler="IconCheck"
          />
        </MenuItemIndicator>
      </span>
      {children}
    </MenuCheckboxItem>
  );
}

const PickerRadioGroup = MenuRadioGroup;

function PickerRadioItem({
  className,
  children,
  closeOnClick,
  ...props
}: Omit<ComponentProps<typeof MenuRadioItem>, "children"> & {
  children?: ReactNode;
  closeOnClick?: boolean;
}) {
  return (
    <MenuRadioItem
      className={cn(
        "site-rounded-lg relative flex cursor-default select-none items-center gap-2 pointer-coarse:gap-3 pointer-coarse:py-2.5 py-1.5 pr-8 pl-2 pointer-coarse:pl-3 pointer-coarse:text-base text-sm outline-hidden focus:bg-site-accent focus:text-site-accent-foreground focus:**:text-site-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      closeOnSelect={closeOnClick}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <MenuItemIndicator>
          <IconPlaceholder
            className="pointer-coarse:size-5 size-4"
            hugeicons="Tick02Icon"
            lucide="CheckIcon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
            tabler="IconCheck"
          />
        </MenuItemIndicator>
      </span>
      {children}
    </MenuRadioItem>
  );
}

function PickerSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuSeparator>) {
  return (
    <MenuSeparator
      className={cn("-mx-1 my-1 h-px bg-site-border", className)}
      {...props}
    />
  );
}

function PickerShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-site-muted-foreground text-xs tracking-widest group-focus/dropdown-menu-item:text-site-accent-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Picker,
  PickerCheckboxItem,
  PickerContent,
  PickerGroup,
  PickerItem,
  PickerLabel,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerShortcut,
  PickerSub,
  PickerSubContent,
  PickerSubTrigger,
  PickerTrigger,
  usePickerSide,
};
