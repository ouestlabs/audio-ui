"use client";

import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ArrowsOutSimpleIcon,
  InfoIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { useCallback } from "react";
import { CopyRegistry } from "@/components/code/copy/copy-registry";
import { MidiConnect } from "@/components/preview/controls/midi-connect";
import { PlaySwitch } from "@/components/preview/controls/play-switch";
import {
  HostSlot,
  type PreviewHost,
} from "@/components/preview/frame/preview-host";
import { BuiltOn } from "@/components/site/built-on";
import {
  Frame,
  FrameContent,
  FrameFooter,
  FrameHeader,
} from "@/components/site/layout/frame";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { takesMidi, takesPlay } from "@/lib/registry/catalog/is-block";
import { cn } from "@/lib/utils";

/** The floating menus a block opens: they sit outside the dialog's DOM, though the block is inside it. */
const FLOATING =
  "[data-slot=select-content],[data-slot=popover-content],[data-slot=dropdown-menu-content],[data-slot=tooltip-content]";

/**
 * A press on one of the block's own menus, or one that lands on the page
 * itself while such a menu is open, is not a press outside the dialog: the
 * block is moved into the dialog, so the dialog cannot tell its menus from
 * the rest of the page.
 */
function isOwnMenuPress(event: Event) {
  const { target } = event;
  if (!(target instanceof Element)) {
    return false;
  }
  return (
    target.closest(FLOATING) !== null ||
    (target === document.body && document.querySelector(FLOATING) !== null)
  );
}

/**
 * A button that opens `children`, a live preview, in a dialog that takes most
 * of the screen, for judging a block at the size it is meant to be used at.
 * What it holds mounts only while it is open.
 */
export function ExpandPreview({
  className,
  hint,
  label,
  preview,
}: {
  className?: string;
  /** How to use the preview, in a footer under it. */
  hint?: string;
  /** Names the preview for assistive technology, such as the block's name. */
  label: string;
  /** What the page and this view share: the component is in the host, whichever of them has it. */
  preview: PreviewHost;
}) {
  const { onOpenChange } = preview;
  const handleOpenChange = useCallback(
    (open: boolean, eventDetails: DialogPrimitive.Root.ChangeEventDetails) => {
      if (
        !open &&
        eventDetails.reason === "outside-press" &&
        isOwnMenuPress(eventDetails.event)
      ) {
        eventDetails.cancel();
        return;
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );
  return (
    <Dialog onOpenChange={handleOpenChange} open={preview.open}>
      <DialogTrigger
        render={
          <Button
            aria-label={`Expand ${label}`}
            className={cn("shrink-0", className)}
            size="icon"
            variant="outline"
          >
            <ArrowsOutSimpleIcon aria-hidden="true" />
          </Button>
        }
      />
      <DialogContent
        className="top-3 left-3 h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-(--frame-radius) bg-site-background p-0 ring-0 sm:max-w-none"
        showCloseButton={false}
      >
        {/* The same frame as a card: a header with the name and what to do with it, and the panel. */}
        <Frame className="size-full rounded-(--frame-radius)">
          <FrameHeader className="shrink-0 flex-row items-center justify-between gap-3 px-2 py-1.5">
            <DialogTitle className="flex flex-1 items-center gap-1.5 truncate ps-1 font-normal text-site-muted-foreground text-xs">
              <BuiltOn />
              <span className="sr-only">{label}</span>
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              {takesPlay(label) ? <PlaySwitch /> : null}
              {takesMidi(label) ? <MidiConnect /> : null}
              <CopyRegistry value={`@audio-ui/${label}`} />
              <DialogClose
                render={
                  <Button aria-label="Close" size="icon" variant="outline" />
                }
              >
                <XIcon aria-hidden="true" />
              </DialogClose>
            </div>
          </FrameHeader>
          <DialogDescription className="sr-only">
            The preview at full size.
          </DialogDescription>
          {/* The block is the page: it fills the panel, which is its only container, and what has a height of its own gives it back to the editor. */}
          <FrameContent
            className="min-h-0 flex-1 p-4 font-sans [&>[data-preview-slot]>[data-preview-host]>div]:h-full [&_[data-slot=plot]]:h-auto [&_[data-slot=plot]]:min-h-0 [&_[data-slot=plot]]:flex-1 [&_.cn-audio-panel]:h-full [&_.cn-audio-panel]:overflow-hidden [&_.cn-audio-panel]:rounded-none [&_.cn-audio-panel]:border-0 [&_.cn-audio-panel]:bg-transparent [&_.cn-audio-panel]:p-0 [&_[data-slot=piano-roll]]:h-auto [&_[data-slot=piano-roll]]:min-h-0 [&_[data-slot=piano-roll]]:flex-1 [&_[data-slot=timeline]]:flex [&_[data-slot=timeline]]:min-h-0 [&_[data-slot=timeline]]:flex-1 [&_[data-slot=timeline]]:flex-col"
            data-expanded-preview
          >
            <HostSlot host={preview.host} />
          </FrameContent>
          {hint ? (
            <FrameFooter className="shrink-0 flex-row items-start gap-2 px-3 py-2">
              <InfoIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-site-muted-foreground"
              />
              <p className="text-site-muted-foreground text-xs">{hint}</p>
            </FrameFooter>
          ) : null}
        </Frame>
      </DialogContent>
    </Dialog>
  );
}
