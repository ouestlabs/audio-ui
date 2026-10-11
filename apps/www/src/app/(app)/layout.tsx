export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="overscroll-behavior relative flex min-h-svh flex-col overscroll-none bg-site-background font-site-sans has-[.bordered-sidebar]:bg-site-muted/60 dark:has-[.bordered-sidebar]:bg-site-background has-[.bordered-sidebar]:[&_header]:bg-[color-mix(in_oklab,var(--site-muted)_60%,var(--site-background))] dark:has-[.bordered-sidebar]:[&_header]:bg-site-background">
      <main className="relative flex flex-1 flex-col">{children}</main>
    </div>
  );
}
