"use client";

import { CodeIcon } from "@phosphor-icons/react";
import { Button } from "@/registry/default/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/default/ui/popover";
import { InstallCommand } from "./install-command";

export function GetCode() {
  return (
    <Popover>
      <PopoverTrigger render={<Button className="w-full" size="sm" />}>
        <CodeIcon aria-hidden="true" className="size-4" />
        Get Code
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80" side="top">
        <InstallCommand />
      </PopoverContent>
    </Popover>
  );
}
