import { SidebarIcon, SlidersHorizontalIcon } from "@phosphor-icons/react/ssr";
import {
  Frame,
  FrameContent,
  FrameFooter,
  FrameHeader,
} from "@/components/custom/frame";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SIDEBAR_ROWS = [64, 80, 48, 72, 56, 88, 60, 76] as const;

/** What the customizer offers, by name: the names are known, the choices are not yet. */
const CUSTOMIZER_CHOICES = [
  "Component Library",
  "Style",
  "Base Color",
  "Theme",
  "Chart Color",
  "Icon Library",
  "Heading",
  "Font",
  "Radius",
  "Menu",
  "Menu Accent",
] as const;

/** The navigation sidebar: what is known (`header`) as it is, a list where the links will be. */
function NavigationSkeleton({ header }: { header?: React.ReactNode }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col lg:flex">
      {header}
      <div aria-hidden className="mt-3 flex flex-col gap-3 px-4">
        {SIDEBAR_ROWS.map((width) => (
          <Skeleton
            className="h-4"
            key={width}
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    </aside>
  );
}

/** The customizer: each choice has its name, only its value is awaited. */
function CustomizerSkeleton() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-1 p-2 lg:flex">
      {CUSTOMIZER_CHOICES.map((name) => (
        <div className="flex items-center justify-between p-2" key={name}>
          <div className="flex flex-col gap-1.5">
            <span className="text-site-muted-foreground text-xs">{name}</span>
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="size-4 rounded-full" />
        </div>
      ))}
    </aside>
  );
}

/**
 * What stands in for the framed layout while its page loads. What the page
 * already has stays as it is: the sidebar's header (`header`), the bar's
 * buttons, the footer (`footer`). Only what is still awaited is a skeleton:
 * the links, the choices' values, the page in the panel (`children`).
 */
export function FramedLayoutSkeleton({
  children,
  footer,
  header,
}: {
  children?: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0">
      <NavigationSkeleton header={header} />
      <div className="min-h-0 min-w-0 flex-1 p-2 pt-0 lg:px-0 lg:pt-2">
        <Frame aria-busy className="h-full" role="status">
          <FrameHeader className="min-h-11 shrink-0 flex-row items-center gap-2 px-2 py-1.5">
            <Button
              aria-label="Toggle navigation"
              className="hidden text-site-muted-foreground lg:inline-flex"
              disabled
              size="icon"
              variant="outline"
            >
              <SidebarIcon aria-hidden />
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                aria-label="Customize"
                className="text-site-muted-foreground"
                disabled
                size="icon"
                variant="outline"
              >
                <SlidersHorizontalIcon aria-hidden />
              </Button>
            </div>
          </FrameHeader>
          <FrameContent className="min-h-0 flex-1 overflow-hidden">
            {children}
          </FrameContent>
          {footer ?? (
            <FrameFooter className="h-10 shrink-0 flex-row items-center justify-center py-0">
              <Skeleton className="h-3 w-56" />
            </FrameFooter>
          )}
        </Frame>
      </div>
      <CustomizerSkeleton />
    </div>
  );
}
