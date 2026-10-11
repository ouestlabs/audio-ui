"use client";

import * as React from "react";
import { Frame } from "@/components/custom/frame";
import { PreviewLoading, PreviewPanel } from "@/components/preview-frame";
import { getComponent } from "@/lib/registry";
import { cn } from "@/lib/utils";

interface ComponentCardContainerProps {
  /** A block: the panel is its frame, and the editor is capped so its card is not far taller than the others, scrolling inside. */
  block?: boolean;
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
    return <PreviewLoading />;
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
      className="rounded-lg flex h-8 select-all ring ring-border items-center gap-1.5 bg-site-background/50 px-2 font-medium text-[10px] text-site-muted-foreground transition-all hover:bg-site-muted hover:text-site-foreground"
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
  block = false,
}: ComponentCardContainerProps) {
  return (
    <Frame className={cn(isFullWidth && "md:col-span-2", className)}>
      <PreviewPanel block={block}>
        <React.Suspense fallback={<PreviewLoading />}>
          {children}
        </React.Suspense>
      </PreviewPanel>
      {footer}
    </Frame>
  );
}
