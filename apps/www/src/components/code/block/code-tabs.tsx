import type * as React from "react";
import { useCallback } from "react";
import { Tabs } from "@/components/ui/tabs";
import { DEFAULT_CONFIG, useConfig } from "@/hooks/use-config";
import { useFramework } from "@/hooks/use-framework";
import { useMounted } from "@/hooks/use-mounted";

export function CodeTabs({ children }: React.ComponentProps<typeof Tabs>) {
  const [config, setConfig] = useConfig();
  const mounted = useMounted();
  const [framework] = useFramework();

  // localStorage-backed config differs from DEFAULT_CONFIG on the client; keep
  // the first client paint aligned with SSR to avoid Radix Tabs hydration errors.
  const installationType = mounted
    ? (config.installationType ?? DEFAULT_CONFIG.installationType)
    : DEFAULT_CONFIG.installationType;
  const handleInstallationChange = useCallback(
    (next: string | null) =>
      next &&
      setConfig({
        ...config,
        installationType: next as "agent" | "cli" | "manual",
      }),
    [config, setConfig]
  );

  // The shadcn CLI is React's: the other frameworks have no CLI tab, and a
  // reader whose choice is the CLI lands on the Manual tab.
  const value =
    installationType === "cli" && framework && framework !== "react"
      ? "manual"
      : installationType;

  return (
    <Tabs
      className="relative mt-6 w-full"
      onValueChange={handleInstallationChange}
      value={value}
    >
      {children}
    </Tabs>
  );
}
