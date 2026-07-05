"use client";

import { Filter } from "lucide-react";
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
    <div className="flex items-center gap-2 lg:hidden">
      <Drawer
        direction="left"
        onOpenChange={setIsDrawerOpen}
        open={isDrawerOpen}
      >
        <DrawerTrigger asChild>
          <Button
            className="-ml-2 text-site-muted-foreground hover:bg-transparent hover:text-site-foreground"
            size="icon-sm"
            variant="ghost"
          >
            <Filter />
          </Button>
        </DrawerTrigger>
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
