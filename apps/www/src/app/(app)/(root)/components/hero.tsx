import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { PixelBlast } from "@/components/custom/pixel-blast";
import { Icons } from "@/components/icons";
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getTotalComponentCount } from "@/lib/registry";

export default function Hero() {
  const totalCount = getTotalComponentCount();

  return (
    <section
      aria-labelledby="hero-heading"
      className="container-wrapper relative flex flex-1 flex-col items-center justify-center overflow-hidden py-16 lg:py-24"
    >
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
            <Button
              nativeButton={false}
              render={
                <Link href="/docs/get-started">
                  Get started
                  <CaretRightIcon className="size-4" />
                </Link>
              }
            />
            <Button
              nativeButton={false}
              render={
                <Link href="/components">Explore {totalCount}+ components</Link>
              }
              variant="outline"
            />
          </PageActions>
        </PageHeader>
      </div>
    </section>
  );
}
