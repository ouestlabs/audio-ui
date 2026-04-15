"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ActiveThemeProvider } from "@/components/theme/active";
import { LayoutProvider } from "@/hooks/use-layout";
import { AudioProvider, demoTracks } from "@/registry/default/ui/audio/player";
import { Toaster } from "@/registry/default/ui/sonner";
import { ThemeProvider } from "./theme";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LayoutProvider>
          <NuqsAdapter>
            <ActiveThemeProvider>
              <AudioProvider tracks={demoTracks}>{children}</AudioProvider>
              <Toaster position="top-center" richColors />
            </ActiveThemeProvider>
          </NuqsAdapter>
        </LayoutProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
