"use client";

import { FunnelIcon, XIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { ComponentSidebarContent } from "./component-sidebar-content";

/** Below `lg`: the categories ride in a full-width sheet, like the customizer's. */
export function ComponentHeaderMobileDrawer() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-2 lg:hidden">
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger
          render={
            <Button
              aria-label="Filter by category"
              className="text-site-muted-foreground"
              size="icon"
              variant="outline"
            >
              <FunnelIcon aria-hidden weight="fill" />
            </Button>
          }
        />
        <SheetContent
          className="w-full! gap-0 sm:max-w-none!"
          showCloseButton={false}
          side="left"
        >
          <div className="flex shrink-0 items-center justify-between p-2">
            <SheetTitle className="inline-flex items-center gap-1.5 px-2 font-medium text-sm">
              <FunnelIcon
                aria-hidden
                className="size-4 shrink-0"
                weight="fill"
              />
              Filters
            </SheetTitle>
            <SheetClose
              render={
                <Button
                  aria-label="Close filters"
                  className="shrink-0"
                  size="icon"
                  variant="ghost"
                >
                  <XIcon aria-hidden weight="bold" />
                </Button>
              }
            />
          </div>
          <SheetDescription className="sr-only">
            Filter components by category.
          </SheetDescription>
          <ComponentSidebarContent onSelect={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
