import Link from "next/link";
import { memo } from "react";
import { PixelBlast } from "@/app/(home)/elements/pixel-blast";
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/layouts/global/headers/page";
import { Button } from "@/registry/default/ui/button";

export const Hero = memo(function _Hero() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <PixelBlast
        enableRipples
        pixelSize={5}
        pixelSizeJitter={0.5}
        rippleIntensityScale={1.5}
        rippleSpeed={0.5}
        speed={0.6}
        transparent
        variant="square"
      />

      <div className="flex flex-col gap-6">
        <PageHeader className="pointer-events-none relative">
          <PageHeaderHeading className="max-w-4xl! text-7xl!">
            <span className="flex items-baseline gap-2 font-serif sm:gap-3">
              <span className="font-bold leading-[0.95] tracking-[-0.03em]">
                Audio
              </span>
              <span className="tracking-[-0.02em] opacity-90">UI</span>
            </span>
          </PageHeaderHeading>
          <PageHeaderDescription>
            A set of accessible and composable Audio UI components. Built on top
            of shadcn/ui, it's designed for you to copy, paste, and own.
          </PageHeaderDescription>
          <PageActions className="pointer-events-auto">
            <Button asChild size="sm">
              <Link href="/docs">Get Started</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/docs/components">View Components</Link>
            </Button>
          </PageActions>
        </PageHeader>
      </div>
    </section>
  );
});
