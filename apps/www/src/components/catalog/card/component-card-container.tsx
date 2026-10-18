"use client";

import * as React from "react";
import {
  PreviewLoading,
  PreviewPanel,
} from "@/components/preview/frame/preview-frame";
import { Frame } from "@/components/site/layout/frame";
import { useMounted } from "@/hooks/use-mounted";
import { getComponent } from "@/lib/registry/core/registry";
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
  loading = <PreviewLoading />,
}: {
  name: string;
  base?: string;
  /** What shows until the component is drawn. */
  loading?: React.ReactNode;
}) {
  const [key, setKey] = React.useState(0);
  const [isReloading, setIsReloading] = React.useState(false);
  const mounted = useMounted();

  React.useEffect(() => {
    const handleReload = (e: Event) => {
      const { detail } = e as CustomEvent;
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

  // Until the page is hydrated its styles are not applied: a preview drawn on the server would show unstyled.
  if (isReloading || !mounted) {
    return loading;
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

  // Its code loads on first render: a boundary of its own keeps the page, which would otherwise hide while it loads.
  return (
    <React.Suspense fallback={loading}>
      <Component key={key} />
    </React.Suspense>
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
