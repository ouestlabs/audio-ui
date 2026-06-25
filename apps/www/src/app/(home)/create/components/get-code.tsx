"use client";

import { CodeIcon } from "@phosphor-icons/react";
import { Button } from "@/registry/bases/base/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/registry/bases/base/ui/dialog";
import { InstallCommand } from "./install-command";

export function GetCode() {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="w-full" size="sm" />}>
        <CodeIcon aria-hidden="true" className="size-4" />
        Get Code
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Get Code</DialogTitle>
        </DialogHeader>
        <InstallCommand />
      </DialogContent>
    </Dialog>
  );
}
