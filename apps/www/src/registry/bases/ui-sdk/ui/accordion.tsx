import {
  AccordionHeader,
  AccordionItem as AccordionItemPrimitive,
  AccordionPanel,
  Accordion as AccordionPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
} from "@ui-sdk/react/accordion";
import type { ComponentProps, ReactNode } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";

function Accordion({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive>) {
  return (
    <AccordionPrimitive
      className={cn("cn-accordion flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionItemPrimitive>) {
  return (
    <AccordionItemPrimitive
      className={cn("cn-accordion-item", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof AccordionTriggerPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <AccordionHeader className="flex">
      <AccordionTriggerPrimitive
        className={cn(
          "cn-accordion-trigger group/accordion-trigger relative flex flex-1 items-start justify-between border border-transparent transition-all outline-none aria-disabled:pointer-events-none aria-disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <IconPlaceholder
          className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
          hugeicons="ArrowDown01Icon"
          lucide="ChevronDownIcon"
          phosphor="CaretDownIcon"
          remixicon="RiArrowDownSLine"
          tabler="IconChevronDown"
        />
        <IconPlaceholder
          className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
          hugeicons="ArrowUp01Icon"
          lucide="ChevronUpIcon"
          phosphor="CaretUpIcon"
          remixicon="RiArrowUpSLine"
          tabler="IconChevronUp"
        />
      </AccordionTriggerPrimitive>
    </AccordionHeader>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof AccordionPanel>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <AccordionPanel className="cn-accordion-content overflow-hidden" {...props}>
      <div
        className={cn(
          "cn-accordion-content-inner h-(--accordion-panel-height) data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className
        )}
      >
        {children}
      </div>
    </AccordionPanel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
