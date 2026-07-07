"use client";

import { CircleNotchIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { Frame, FrameContent, FrameFooter } from "@/components/custom/frame";
import { Spinner } from "@/components/ui/spinner";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { getComponent } from "@/lib/registry";
import { cn } from "@/lib/utils";

interface ComponentCardContainerProps {
  children: React.ReactNode;
  className?: string;
  footer: React.ReactNode;
  isFullWidth?: boolean;
}

export function ComponentRenderer({
  name,
  base = "base",
}: {
  name: string;
  base?: string;
}) {
  const [key, setKey] = React.useState(0);
  const [isReloading, setIsReloading] = React.useState(false);

  React.useEffect(() => {
    const handleReload = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.name === name) {
        setIsReloading(true);
        setKey((k) => k + 1);
        // Add a small delay to make the reload feel substantive and show the spinner
        setTimeout(() => setIsReloading(false), 200);
      }
    };
    window.addEventListener("component-preview-reload", handleReload);
    return () =>
      window.removeEventListener("component-preview-reload", handleReload);
  }, [name]);

  if (isReloading) {
    return (
      <div className="flex h-full min-h-20 items-center justify-center">
        <Spinner className="text-site-muted-foreground/40" />
      </div>
    );
  }

  // Get component using lazy loader (component created on-demand)
  const Component = getComponent(base, name);

  if (!Component) {
    return (
      <div className="flex items-center justify-center p-6 text-site-muted-foreground text-sm">
        Component {name} not found in {base}
      </div>
    );
  }

  return <Component key={key} />;
}

export function ComponentName({ name }: { name: string }) {
  return (
    <div
      className="site-rounded-md flex h-8 select-all items-center gap-1.5 bg-site-muted/50 px-2 font-medium text-[10px] text-site-muted-foreground transition-all hover:bg-site-muted hover:text-site-foreground"
      title="Component name"
    >
      {name}
    </div>
  );
}

export function ComponentCardContainer({
  children,
  footer,
  className,
  isFullWidth,
}: ComponentCardContainerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // freezeOnceVisible latches isIntersecting to true once seen, so it also
  // serves as the "has been visible" flag.
  const hasBeenVisible = useIntersectionObserver(containerRef, {
    freezeOnceVisible: true,
    rootMargin: "800px",
    threshold: 0,
  });

  return (
    <Frame
      className={cn(
        "[contain-intrinsic-size:0_400px] [content-visibility:auto]",
        isFullWidth && "md:col-span-2",
        className
      )}
      // content-visibility: auto defers off-screen rendering (vercel-react-best-practices: rendering-content-visibility)
      // contain-intrinsic-size provides estimated height to prevent layout shift
      ref={containerRef}
    >
      <FrameContent
        className={cn(
          "flex min-h-50 min-w-0 flex-1 flex-col flex-wrap items-center justify-center overflow-x-auto bg-site-background p-6 font-sans **:data-[slot=preview]:w-full sm:**:data-[slot=preview]:max-w-[80%] lg:px-8 lg:py-12"
        )}
      >
        {hasBeenVisible ? (
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center py-10">
                <CircleNotchIcon className="size-6 animate-spin text-site-muted-foreground/40" />
              </div>
            }
          >
            {children}
          </React.Suspense>
        ) : (
          <div className="flex h-50 w-full items-center justify-center">
            <CircleNotchIcon className="size-5 animate-spin text-site-muted-foreground/10" />
          </div>
        )}
      </FrameContent>
      <FrameFooter className="flex-row items-center gap-3 px-2 py-1.5">
        {footer}
      </FrameFooter>
    </Frame>
  );
}
