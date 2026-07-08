"use client";

import { FunnelIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import { ComponentSidebarContent } from "./component-sidebar-content";

export function ComponentHeaderMobileDrawer() {
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-2 md:hidden">
      <Drawer
        onOpenChange={setIsDrawerOpen}
        open={isDrawerOpen}
        swipeDirection="left"
      >
        <DrawerTrigger
          render={
            <Button
              className="text-site-muted-foreground"
              size="icon"
              variant="outline"
            >
              <FunnelIcon />
            </Button>
          }
        />
        <DrawerContent className="h-full">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Filters</DrawerTitle>
            <DrawerDescription>
              Filter components by category.
            </DrawerDescription>
          </DrawerHeader>
          <div className="h-full py-4">
            <ComponentSidebarContent
              onSelect={() => setIsDrawerOpen(false)}
              view="list"
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
