"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/**
 * What an expandable preview shares between its page and its full-size view.
 * The component is rendered once, into a host element that is moved from the
 * one place to the other, so it keeps its state (a note drawn, a clock
 * playing, a band moved) as it changes size.
 */
export interface PreviewHost {
  host: HTMLElement | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function usePreviewHost(enabled: boolean): PreviewHost {
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    const element = document.createElement("div");
    element.style.display = "contents";
    element.dataset.previewHost = "";
    setHost(element);
    return () => setHost(null);
  }, [enabled]);
  return { host, onOpenChange: setOpen, open };
}

/** Where the host sits: here when the view is closed, in the dialog when it is open. */
export function HostSlot({ host }: { host: HTMLElement | null }) {
  const adopt = React.useCallback(
    (node: HTMLElement | null) => {
      if (node && host) {
        node.appendChild(host);
      }
    },
    [host]
  );
  return <div data-preview-slot ref={adopt} style={{ display: "contents" }} />;
}

/** Renders `children` once, into the host, and puts the host in the page unless the full-size view has it. */
export function HostedPreview({
  children,
  host,
  open,
}: {
  children: React.ReactNode;
  host: HTMLElement | null;
  open: boolean;
}) {
  const slotRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (!open && host && slotRef.current) {
      slotRef.current.appendChild(host);
    }
  }, [host, open]);
  return (
    <>
      <div data-preview-slot ref={slotRef} style={{ display: "contents" }} />
      {host ? createPortal(children, host) : null}
    </>
  );
}
