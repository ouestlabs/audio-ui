"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DEFAULT_CONFIG, useConfig } from "@/hooks/use-config";

export function ResetButton() {
  const [open, setOpen] = React.useState(false);
  const [_params, setParams] = useDesignSystemSearchParams();
  const [_config, setConfig] = useConfig();
  const handleReset = React.useCallback(() => {
    // Update URL params - set to null to clear them from URL
    setParams({
      base: null,
      baseColor: null,
      chartColor: null,
      font: null,
      fontHeading: null,
      iconLibrary: null,
      item: null,
      menuAccent: null,
      menuColor: null,
      radius: null,
      search: null, // Also clear search
      style: null,
      template: null,
      theme: null,
    });

    // Also update config storage directly for immediate persistence
    setConfig((prev) => ({
      ...prev,
      ...DEFAULT_CONFIG,
    }));

    setOpen(false);
  }, [setParams, setConfig]);

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger
        render={
          <Button
            className="site-rounded-xl sm:site-rounded-lg md:site-rounded-lg in-data-[slot=sheet-content]:site-rounded-lg hidden h-[calc(--spacing(13.5))] w-[140px] touch-manipulation select-none justify-between border border-site-foreground/10 bg-site-muted/50 focus-visible:border-transparent focus-visible:ring-1 md:flex in-data-[slot=sheet-content]:flex md:w-full in-data-[slot=sheet-content]:w-full md:border-transparent in-data-[slot=sheet-content]:border-transparent md:bg-transparent in-data-[slot=sheet-content]:bg-transparent md:pr-3.5! in-data-[slot=sheet-content]:pr-3.5! md:pl-2! in-data-[slot=sheet-content]:pl-2!"
            size="sm"
            variant="ghost"
          >
            <div className="flex flex-col justify-start text-left">
              <div className="text-site-muted-foreground text-xs">Reset</div>
              <div className="font-medium text-site-foreground text-sm">
                Start Over
              </div>
            </div>
            <ArrowCounterClockwiseIcon className="-translate-x-0.5" />
          </Button>
        }
      />
      <AlertDialogContent className="dialog-ring p-4 sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
          <AlertDialogDescription>
            This will reset all customization options to their default values.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
