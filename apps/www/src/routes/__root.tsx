import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { PostHogProvider } from "@posthog/react";
import { Provider as JotaiProvider } from "jotai";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { DESIGN_SYSTEM_BOOT_SCRIPT } from "@/app/(create)/lib/boot-cache";
import { JsonLd } from "@/components/json-ld";
import { QueryProvider } from "@/components/query-provider";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { META_THEME_COLORS, siteConfig } from "@/lib/config";
import {
  buildAuthorJsonLd,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildWebSiteJsonLd,
  DEFAULT_ROBOTS,
  getSiteAuthors,
} from "@/lib/seo";
import { cn } from "@/lib/utils";
import fontsCss from "@/styles/fonts.css?url";
import globalsCss from "@/styles/globals.css?url";

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
/** PostHog reads through the site's own address (/ingest), so blockers leave it be; it is off in development and without a key. */
const POSTHOG_OPTIONS = {
  api_host: "/ingest",
  capture_exceptions: true,
  defaults: "2026-01-30",
  ui_host: "https://us.posthog.com",
} as const;

function Analytics({ children }: { children: React.ReactNode }) {
  if (!(import.meta.env.PROD && posthogKey)) {
    return children;
  }
  return (
    <PostHogProvider apiKey={posthogKey} options={POSTHOG_OPTIONS}>
      {children}
    </PostHogProvider>
  );
}

const SITE_KEYWORDS = [
  "audio ui components",
  "react audio components",
  "shadcn audio components",
  "web audio react",
  "audio player react",
  "knob component react",
  "fader component react",
  "xy pad react",
  "channel strip react",
  "shadcn/ui audio",
  "shadcn/ui",
  "shadcn ui",
  "shadcn ecosystem",
  "React components",
  "Tailwind CSS components",
  "open source UI",
  "component library",
  "design system",
];

const THEME_SCRIPT = `
  try {
    if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
    }
    if (localStorage.layout) {
      document.documentElement.classList.add('layout-' + localStorage.layout)
    }
  } catch (_) {}
`;

const HIGHLIGHT_THEME_CSS = createThemeCss({
  dark: githubDarkTheme,
  darkSelector: ".dark",
  light: githubLightTheme,
});

// The site-wide defaults of the meta tags; a page's own replace them, and its links (canonical, alternates) come from the page alone.
const siteHead = buildPageMetadata({
  description: siteConfig.description,
  keywords: SITE_KEYWORDS,
  path: "/",
  robots: DEFAULT_ROBOTS,
  title: siteConfig.name,
});

export const Route = createRootRoute({
  component: RootDocument,
  head: () => ({
    links: [
      { href: globalsCss, rel: "stylesheet" },
      { href: fontsCss, rel: "stylesheet" },
      { href: "/manifest.webmanifest", rel: "manifest" },
      { href: "/icon.svg", rel: "icon", type: "image/svg+xml" },
      { href: "/apple-icon.png", rel: "apple-touch-icon" },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { content: META_THEME_COLORS.light, name: "theme-color" },
      ...getSiteAuthors(),
      ...siteHead.meta,
    ],
    scripts: [
      { children: THEME_SCRIPT },
      { children: DESIGN_SYSTEM_BOOT_SCRIPT },
    ],
    styles: [{ children: HIGHLIGHT_THEME_CSS }],
  }),
});

function RootDocument() {
  return (
    <html
      className="no-scrollbar overscroll-none"
      data-scroll-behavior="smooth"
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body
        className={cn(
          "group/body overscroll-none antialiased [--footer-height:--spacing(14)] [--header-height:--spacing(14)] xl:[--footer-height:--spacing(24)]",
          "[&:not(:has([data-slot=component-preview]))]:font-site-sans"
        )}
        suppressHydrationWarning
      >
        <JsonLd data={buildWebSiteJsonLd()} />
        <JsonLd data={buildOrganizationJsonLd()} />
        <JsonLd data={buildAuthorJsonLd()} />
        <ThemeProvider>
          <QueryProvider>
            <NuqsAdapter>
              <JotaiProvider>
                <Analytics>
                  <Outlet />
                </Analytics>
                <TailwindIndicator />
                <Toaster position="top-center" />
              </JotaiProvider>
            </NuqsAdapter>
          </QueryProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
