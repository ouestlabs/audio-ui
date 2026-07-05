import { SiteHeader } from "@/components/site-header";

export default function RootAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="sticky top-0 z-50 flex flex-col">
        <SiteHeader sticky={false} />
      </div>
      {children}
    </>
  );
}
