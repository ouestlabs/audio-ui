import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const KEPT = "audio-ui-daw:small-screen";

/**
 * On a phone or a narrow window, says the workstation is made for a computer,
 * and opens it anyway on a press. Asked once per browser.
 */
export function SmallScreenNotice() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (
        window.matchMedia("(max-width: 767px)").matches &&
        !localStorage.getItem(KEPT)
      ) {
        setOpen(true);
      }
    } catch {
      // No storage: the workstation opens as it is.
    }
  }, []);
  const change = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      try {
        localStorage.setItem(KEPT, "seen");
      } catch {
        // Refused: it asks again next time.
      }
    }
  }, []);
  const close = useCallback(() => change(false), [change]);
  return (
    <Dialog onOpenChange={change} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Made for a computer</DialogTitle>
          <DialogDescription>
            The workstation needs room, a mouse and a keyboard. On a screen this
            narrow, parts of it won't fit.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={close}>Open the workstation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
