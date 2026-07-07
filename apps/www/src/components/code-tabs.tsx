"use client";

import type * as React from "react";
import { Tabs } from "@/components/ui/tabs";
import { DEFAULT_CONFIG, useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";

export function CodeTabs({ children }: React.ComponentProps<typeof Tabs>) {
  const [config, setConfig] = useConfig();
  const mounted = useMounted();

  // localStorage-backed config differs from DEFAULT_CONFIG on the client; keep
  // the first client paint aligned with SSR to avoid Radix Tabs hydration errors.
  const installationType = mounted
    ? (config.installationType ?? DEFAULT_CONFIG.installationType)
    : DEFAULT_CONFIG.installationType;

  return (
    <Tabs
      className="relative mt-6 w-full"
      onValueChange={(value) =>
        setConfig({ ...config, installationType: value as "cli" | "manual" })
      }
      value={installationType}
    >
      {children}
    </Tabs>
  );
}
