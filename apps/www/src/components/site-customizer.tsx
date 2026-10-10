"use client";

import { SlidersHorizontalIcon } from "@phosphor-icons/react/ssr";
import { usePathname } from "next/navigation";
import * as React from "react";
import { CustomizerContext } from "@/app/(create)/components/components/components-context";
import { CustomizerPanel } from "@/app/(create)/components/components/customizer-panel";
import { LocksProvider } from "@/app/(create)/hooks/use-locks";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/** Pages that carry their own customizer: the home showcase and the catalog. */
function hasOwnCustomizer(pathname: string) {
  return pathname === "/" || pathname.startsWith("/components");
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * The customizer, within reach on every page: a button in the corner, or the
 * C key, opens it over the page. Each choice shows on the page behind it as
 * it is made, and the choices are the ones the home page and the catalog use.
 */
export function SiteCustomizer() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  // A key opens it without the easing-in: what is done often should not wait.
  const [animate, setAnimate] = React.useState(true);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const standalone = !hasOwnCustomizer(pathname);

  const toggle = React.useCallback(() => {
    setOpen((current) => !current);
  }, []);

  React.useEffect(() => {
    if (!standalone) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open && !event.defaultPrevented) {
        setOpen(false);
        return;
      }
      if (
        event.key.toLowerCase() !== "c" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target)
      ) {
        return;
      }
      event.preventDefault();
      setAnimate(false);
      toggle();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, standalone, toggle]);

  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (wasOpen.current && !open) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  const handleTriggerClick = React.useCallback(() => {
    setAnimate(true);
    toggle();
  }, [toggle]);

  const value = React.useMemo(
    () => ({
      customizerOpen: open,
      setCustomizerOpen: setOpen,
      toggleCustomizer: toggle,
    }),
    [open, toggle]
  );

  if (!standalone) {
    return null;
  }

  // On the docs, a bar of page links sits along the bottom on small screens.
  const lifted = pathname.startsWith("/docs");

  return (
    <LocksProvider>
      <CustomizerContext value={value}>
        <CustomizerPanel
          animate={animate}
          className={lifted ? "bottom-32" : "bottom-16"}
          variant="floating"
        />
        <Button
          aria-expanded={open}
          aria-label="Customize"
          className={cn(
            "fixed right-4 z-40 h-10 gap-2 rounded-full bg-site-background px-3.5 shadow-lg transition-transform duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none",
            lifted ? "bottom-20 md:bottom-4" : "bottom-4",
            // From md up the panel takes the whole height and covers it.
            open && "md:invisible"
          )}
          onClick={handleTriggerClick}
          ref={triggerRef}
          variant="outline"
        >
          <SlidersHorizontalIcon aria-hidden className="size-4" weight="bold" />
          <span className="hidden md:inline">Customize</span>
          <Kbd className="hidden md:inline-flex">C</Kbd>
        </Button>
      </CustomizerContext>
    </LocksProvider>
  );
}
