import { SiteHeader } from "@/components/site-header";

export default function RootAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-50 flex flex-col">
        <SiteHeader sticky={false} />
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
