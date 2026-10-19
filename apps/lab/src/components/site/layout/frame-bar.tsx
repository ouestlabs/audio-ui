import {
  ArrowsInIcon,
  ArrowsOutIcon,
  CodeIcon,
  InfoIcon,
  SidebarIcon,
} from "@phosphor-icons/react/ssr";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { type ReactNode, useCallback } from "react";
import { MidiConnectControl } from "@/components/audio-ui/midi-connect-control";
import { HotkeyKbd } from "@/components/site/hotkey-kbd";
import { useLab } from "@/components/site/providers/lab-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEVICES } from "@/lib/devices";
import { HOTKEYS, type LabHotkey } from "@/lib/hotkeys";

/** An icon button of the bar, with its name and its key in the tooltip. */
function BarButton({
  children,
  className,
  label,
  onClick,
  pressed,
  hotkey,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  hotkey?: LabHotkey;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={pressed}
            className={cn("text-muted-foreground", className)}
            onClick={onClick}
            size="icon"
            variant="outline"
          >
            {children}
          </Button>
        }
      />
      <TooltipContent className="flex items-center gap-2" side="bottom">
        {label}
        {hotkey ? <HotkeyKbd hotkey={hotkey} /> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** The bar of the frame: the navigation, where you are, and what you can do with the device. */
export function FrameBar() {
  const { actions, state } = useLab();
  const { setFocus, setSourceOpen, toggleDetails, toggleFocus } = actions;
  const { detailsOpen, focus } = state;
  const { toggleSidebar } = useSidebar();
  const { device: slug } = useParams({ strict: false });
  const device = DEVICES.find((item) => item.slug === slug);

  useHotkey(HOTKEYS.navigation, toggleSidebar);
  useHotkey(HOTKEYS.details, toggleDetails);
  useHotkey(HOTKEYS.focus, toggleFocus);
  const openSource = useCallback(() => setSourceOpen(true), [setSourceOpen]);
  useHotkey(HOTKEYS.source, openSource);
  const leaveFocus = useCallback(() => setFocus(false), [setFocus]);
  useHotkey(HOTKEYS.leaveFocus, leaveFocus, { enabled: focus });

  return (
    <>
      {focus ? null : (
        <>
          <BarButton
            hotkey={HOTKEYS.navigation}
            label="Toggle navigation"
            onClick={toggleSidebar}
          >
            <SidebarIcon aria-hidden />
          </BarButton>
          <Separator orientation="vertical" />
        </>
      )}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {device ? (
              <BreadcrumbLink render={<Link to="/">Lab</Link>} />
            ) : (
              <BreadcrumbPage>Lab</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {device ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="hidden sm:flex">
                {device.category}
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{device.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <MidiConnectControl />
        {device ? (
          <>
            <BarButton
              hotkey={HOTKEYS.source}
              label="View the source"
              onClick={openSource}
            >
              <CodeIcon aria-hidden />
            </BarButton>
            <BarButton
              className="max-md:hidden"
              hotkey={HOTKEYS.focus}
              label={focus ? "Leave focus" : "Focus on the device"}
              onClick={toggleFocus}
              pressed={focus}
            >
              {focus ? (
                <ArrowsInIcon aria-hidden />
              ) : (
                <ArrowsOutIcon aria-hidden />
              )}
            </BarButton>
          </>
        ) : null}
        {focus ? null : (
          <BarButton
            hotkey={HOTKEYS.details}
            label="Toggle details"
            onClick={toggleDetails}
            pressed={detailsOpen}
          >
            <InfoIcon aria-hidden />
          </BarButton>
        )}
      </div>
    </>
  );
}
