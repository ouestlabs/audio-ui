import { Link, useLocation } from "@tanstack/react-router";
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

export function AppSidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <Sidebar>
      <SidebarHeader>
        <Link className="px-2 py-1 font-semibold text-sm" to="/">
          audio/ui lab
        </Link>
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
