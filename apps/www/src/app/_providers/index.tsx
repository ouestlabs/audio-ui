"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { LayoutProvider } from "@/hooks/use-layout";
import {
  AudioProvider,
  demoTracks,
} from "@/registry/bases/base/ui/audio/player";
import { Toaster } from "@/registry/bases/base/ui/sonner";
import { ThemeProvider } from "./theme";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LayoutProvider>
          <NuqsAdapter>
            <AudioProvider tracks={demoTracks}>{children}</AudioProvider>
            <Toaster position="top-center" richColors />
          </NuqsAdapter>
        </LayoutProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
