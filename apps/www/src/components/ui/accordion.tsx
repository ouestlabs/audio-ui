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
      className={cn(" flex w-full flex-col", className)}
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
      className={cn("not-last:border-b", className)}
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
          "focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:after:border-ring **:data-[slot=accordion-trigger-icon]:text-muted-foreground rounded-lg py-2.5 text-left text-sm font-medium hover:underline focus-visible:ring-3 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 group/accordion-trigger relative flex flex-1 items-start justify-between border border-transparent transition-all outline-none aria-disabled:pointer-events-none aria-disabled:opacity-50",
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
    <AccordionPanel
      className="data-open:animate-accordion-down data-closed:animate-accordion-up text-sm overflow-hidden"
      {...props}
    >
      <div
        className={cn(
          "pt-0 pb-2.5 h-(--accordion-panel-height) data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className
        )}
      >
        {children}
      </div>
    </AccordionPanel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
