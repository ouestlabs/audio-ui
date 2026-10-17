"use client";

import * as React from "react";
import { ACTION_BUTTON_CLASS } from "@/components/customizer/actions/action-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useConfig } from "@/hooks/use-config";
import {
  parsePresetInput,
  readPresetCode,
} from "@/lib/design-system/preset-code";
import { useDesignSystemSearchParams } from "@/lib/design-system/search-params";
import { trackEvent } from "@/lib/events";

const EXAMPLE = "b4iTmardw";

/** Asks for a code, bare or with its `--preset` flag, and puts that design on the page. Open with the O key. */
export function OpenPreset() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [, setParams] = useDesignSystemSearchParams();
  const [, setConfig] = useConfig();

  const code = React.useMemo(() => parsePresetInput(input), [input]);
  const invalid = input.trim().length > 0 && code === null;

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setInput("");
    }
  }, []);

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setInput(event.target.value),
    []
  );

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const design = code ? readPresetCode(code) : null;
      if (!design) {
        return;
      }
      setConfig((previous) => ({ ...previous, ...design }));
      setParams(design);
      trackEvent({ name: "open_preset", properties: { preset: code } });
      handleOpenChange(false);
    },
    [code, handleOpenChange, setConfig, setParams]
  );

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        (event.key !== "o" && event.key !== "O") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const { target } = event;
      if (
        (target instanceof HTMLElement && target.isContentEditable) ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button className={ACTION_BUTTON_CLASS} size="sm" variant="ghost" />
        }
      >
        <div className="flex flex-col justify-start text-left">
          <div className="text-site-muted-foreground text-xs">Import</div>
          <div className="font-medium text-site-foreground text-sm">
            Open Preset
          </div>
        </div>
        <Kbd className="hidden bg-site-foreground/10 text-site-foreground md:flex in-data-[slot=sheet-content]:flex">
          O
        </Kbd>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Open Preset</DialogTitle>
            <DialogDescription>
              Paste a preset code to load a saved design.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              aria-invalid={invalid}
              aria-label="Preset code"
              autoCapitalize="none"
              autoCorrect="off"
              onChange={handleInputChange}
              placeholder={`${EXAMPLE} or --preset ${EXAMPLE}`}
              spellCheck={false}
              value={input}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={code === null} type="submit">
              Open
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
