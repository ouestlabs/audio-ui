import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderProvider } from "./components/builder-provider";
import { Customizer } from "./components/customizer";
import { BuilderPreview } from "./components/preview";

export const metadata: Metadata = {
  title: "Create — audio/ui",
  description:
    "Pick your Base UI style, base color, radius, font, and mode. Preview audio/ui components live and copy your install command.",
};

export default function CreatePage() {
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden [--customizer-width:theme(spacing.64)] 2xl:[--customizer-width:theme(spacing.72)]">
      <Suspense>
        <BuilderProvider>
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-1 md:flex-row-reverse">
            <Customizer />
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <BuilderPreview />
            </div>
          </div>
        </BuilderProvider>
      </Suspense>
    </div>
  );
}
