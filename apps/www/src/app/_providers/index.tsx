"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ActiveThemeProvider } from "@/components/theme/active";
import { LayoutProvider } from "@/hooks/use-layout";
import {
  AudioProvider,
  demoTracks,
} from "@/registry/default/ui/audio/provider";
import { Toaster } from "@/registry/default/ui/sonner";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
      >
        <LayoutProvider>
          <NuqsAdapter>
            <ActiveThemeProvider>
              <AudioProvider tracks={demoTracks}>
                {children}
              </AudioProvider>
              <Toaster position="top-center" richColors />
            </ActiveThemeProvider>
          </NuqsAdapter>
        </LayoutProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
