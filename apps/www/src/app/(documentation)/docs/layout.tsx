import { DocsSidebar } from "@/components/layouts/doc/sidebar";
import { source } from "@/lib/source";
import { SidebarProvider } from "@/registry/bases/base/ui/sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col">
      <SidebarProvider className="container min-h-min flex-1 items-start px-0 [--sidebar-width:220px] [--top-spacing:0] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] lg:[--sidebar-width:240px] lg:[--top-spacing:calc(var(--spacing)*4)]">
        <DocsSidebar tree={source.pageTree} />
        <div className="size-full">{children}</div>
      </SidebarProvider>
    </main>
  );
}
