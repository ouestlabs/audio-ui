import {
  CarouselContent as CarouselContentPrimitive,
  CarouselItem as CarouselItemPrimitive,
  CarouselNext as CarouselNextPrimitive,
  CarouselPrevious as CarouselPreviousPrimitive,
  Carousel as CarouselPrimitive,
  CarouselViewport,
} from "@ui-sdk/react/carousel";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/registry/bases/ui-sdk/ui/button";

function Carousel({
  className,
  ...props
}: ComponentProps<typeof CarouselPrimitive>) {
  return (
    <CarouselPrimitive
      className={cn("group/carousel relative", className)}
      {...props}
    />
  );
}

// The slides scroll natively: each one ends with its gap, so a snap lands on the slide, not on a gap.
function CarouselContent({
  className,
  ...props
}: ComponentProps<typeof CarouselContentPrimitive>) {
  return (
    <CarouselViewport className="[scrollbar-width:none]">
      <CarouselContentPrimitive
        className={cn(
          "flex data-[orientation=horizontal]:-me-4 data-[orientation=vertical]:-mb-4 data-[orientation=vertical]:flex-col",
          className
        )}
        {...props}
      />
    </CarouselViewport>
  );
}

function CarouselItem({
  className,
  ...props
}: ComponentProps<typeof CarouselItemPrimitive>) {
  return (
    <CarouselItemPrimitive
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full data-[orientation=horizontal]:pe-4 data-[orientation=vertical]:pb-4",
        className
      )}
      {...props}
    />
  );
}

type StepProps = ComponentProps<typeof CarouselPreviousPrimitive> &
  VariantProps<typeof buttonVariants>;

function CarouselPrevious({
  className,
  variant = "outline",
  size = "icon-sm",
  ...props
}: StepProps) {
  return (
    <CarouselPreviousPrimitive
      className={cn(
        buttonVariants({ size, variant }),
        "cn-carousel-previous absolute touch-manipulation group-data-[orientation=horizontal]/carousel:inset-y-0 group-data-[orientation=horizontal]/carousel:-inset-s-12 group-data-[orientation=horizontal]/carousel:my-auto group-data-[orientation=vertical]/carousel:-top-12 group-data-[orientation=vertical]/carousel:left-1/2 group-data-[orientation=vertical]/carousel:-translate-x-1/2 group-data-[orientation=vertical]/carousel:rotate-90",
        className
      )}
      {...props}
    >
      <IconPlaceholder
        className="rtl:rotate-180"
        hugeicons="ArrowLeft01Icon"
        lucide="ChevronLeftIcon"
        phosphor="CaretLeftIcon"
        remixicon="RiArrowLeftSLine"
        tabler="IconChevronLeft"
      />
      <span className="sr-only">Previous slide</span>
    </CarouselPreviousPrimitive>
  );
}

function CarouselNext({
  className,
  variant = "outline",
  size = "icon-sm",
  ...props
}: StepProps) {
  return (
    <CarouselNextPrimitive
      className={cn(
        buttonVariants({ size, variant }),
        "cn-carousel-next absolute touch-manipulation group-data-[orientation=horizontal]/carousel:inset-y-0 group-data-[orientation=horizontal]/carousel:-inset-e-12 group-data-[orientation=horizontal]/carousel:my-auto group-data-[orientation=vertical]/carousel:-bottom-12 group-data-[orientation=vertical]/carousel:left-1/2 group-data-[orientation=vertical]/carousel:-translate-x-1/2 group-data-[orientation=vertical]/carousel:rotate-90",
        className
      )}
      {...props}
    >
      <IconPlaceholder
        className="rtl:rotate-180"
        hugeicons="ArrowRight01Icon"
        lucide="ChevronRightIcon"
        phosphor="CaretRightIcon"
        remixicon="RiArrowRightSLine"
        tabler="IconChevronRight"
      />
      <span className="sr-only">Next slide</span>
    </CarouselNextPrimitive>
  );
}

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
};
