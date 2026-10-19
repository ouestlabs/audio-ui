import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import { Link, useLocation } from "@tanstack/react-router";
import { useCallback } from "react";
import { HotkeyKbd } from "@/components/site/hotkey-kbd";
import { ModeSwitcher } from "@/components/site/navigation/mode-switcher";
import { Shortcuts } from "@/components/site/navigation/shortcuts";
import { useLab } from "@/components/site/providers/lab-provider";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { DEVICES, groupByCategory } from "@/lib/devices";
import { HOTKEYS } from "@/lib/hotkeys";

/** The audio/ui mark, as the docs draw it. */
function AudioUiIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M13.799 11.884L18.243 4.188A10 10 0 1 1 15.645 2.688L11.201 10.384Z" />
    </svg>
  );
}

export function LabSidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { setCommandOpen } = useLab().actions;
  const groups = groupByCategory(DEVICES);
  const openSearch = useCallback(() => setCommandOpen(true), [setCommandOpen]);

  return (
    <Sidebar className="bg-transparent group-data-[side=left]:border-r-0 **:data-[slot=sidebar-inner]:bg-transparent">
      <SidebarHeader className="gap-2">
        <div className="flex items-center justify-between">
          <Button
            className="w-fit pl-2"
            nativeButton={false}
            render={
              <Link
                aria-label="audio/ui lab, home"
                className="flex items-center"
                to="/"
              >
                <span
                  aria-hidden
                  className="flex select-none items-center gap-1"
                >
                  <AudioUiIcon className="pointer-events-none size-5 text-foreground" />
                  <span className="mt-[-2.3px] font-medium font-serif text-xl leading-snug">
                    audio/ui
                  </span>
                  <span className="ml-1 rounded-md border px-1.5 py-0.5 text-muted-foreground text-xs">
                    lab
                  </span>
                </span>
              </Link>
            }
            variant="ghost"
          />
          <ModeSwitcher />
        </div>
        <Button
          className="w-full justify-between bg-foreground/8 pr-1.5 font-normal hover:bg-foreground/12"
          onClick={openSearch}
          variant="secondary"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <MagnifyingGlassIcon aria-hidden />
            Search devices
          </span>
          <HotkeyKbd className="border" hotkey={HOTKEYS.search} />
        </Button>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.category}>
            <SidebarGroupLabel>{group.category}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.devices.map((device) => (
                  <SidebarMenuItem key={device.slug}>
                    <SidebarMenuButton
                      isActive={pathname === `/${device.slug}`}
                      render={
                        <Link params={{ device: device.slug }} to="/$device">
                          {device.title}
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {/* Keys have no use on a touch screen, where this sidebar is a sheet. */}
      <SidebarFooter className="max-md:hidden">
        <Shortcuts />
      </SidebarFooter>
    </Sidebar>
  );
}
