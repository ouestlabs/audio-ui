import { DocsDesignSystemSync } from "@/components/docs-design-system-sync";
import { DocsShell } from "@/components/docs-shell";
import { DocsSidebar } from "@/components/docs-sidebar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { source } from "@/lib/source";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <DocsDesignSystemSync>
        <DocsShell
          footer={<SiteFooter docs />}
          nav={<DocsSidebar tree={source.getPageTree()} />}
        >
          {children}
        </DocsShell>
      </DocsDesignSystemSync>
    </>
  );
}
