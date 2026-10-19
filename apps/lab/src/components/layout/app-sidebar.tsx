import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { DEVICES } from "../../devices.ts";
import { ModeSwitcher } from "./mode-switcher.tsx";

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

export function AppSidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <Sidebar className="bg-transparent group-data-[side=left]:border-r-0 **:data-[slot=sidebar-inner]:bg-transparent">
      <SidebarHeader className="flex-row items-center justify-between">
        <Button
          className="w-fit pl-2"
          nativeButton={false}
          render={
            <Link
              aria-label="audio/ui lab, home"
              className="flex items-center"
              to="/"
            >
              <span aria-hidden className="flex select-none items-center gap-1">
                <AudioUiIcon className="pointer-events-none size-5 text-foreground" />
                <span className="-mt-[2.3px] font-medium font-serif text-xl leading-snug">
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
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Devices</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DEVICES.map((device) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
