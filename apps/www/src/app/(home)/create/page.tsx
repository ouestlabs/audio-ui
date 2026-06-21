import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoGrid } from "@/app/(home)/elements/demo-grid";
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40 [--customizer-width:--spacing(56)] [--gap:--spacing(3)] dark:bg-muted/20 md:[--gap:--spacing(4)] 2xl:[--customizer-width:--spacing(64)]">
      <Suspense>
        <BuilderProvider>
          <div className="flex h-[calc(100svh-var(--header-height,4rem))] flex-col gap-(--gap) p-(--gap) md:flex-row">
            <Customizer />
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <BuilderPreview>
                <DemoGrid />
              </BuilderPreview>
            </div>
          </div>
        </BuilderProvider>
      </Suspense>
    </div>
  );
}
