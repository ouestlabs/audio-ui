import { PostHogProvider } from "@posthog/react";
import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Provider as JotaiProvider } from "jotai";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import posthog from "posthog-js";
import { useEffect } from "react";
import { JsonLd } from "@/components/site/json-ld";
import { QueryProvider } from "@/components/site/providers/query-provider";
import { ThemeProvider } from "@/components/site/providers/theme-provider";
import { TailwindIndicator } from "@/components/site/tailwind-indicator";
import { Toaster } from "@/components/ui/sonner";
import { META_THEME_COLORS, siteConfig } from "@/lib/config";
import { DESIGN_SYSTEM_BOOT_SCRIPT } from "@/lib/design-system/boot-cache";
import { watchStyleCss } from "@/lib/design-system/style-css";
import {
  buildAuthorJsonLd,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildWebSiteJsonLd,
  DEFAULT_ROBOTS,
  getSiteAuthors,
} from "@/lib/seo/seo";
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

/**
 * PostHog's provider holds the client from the first render, but the client
 * starts when the browser is idle, after the page is interactive: its session
 * recorder walks the whole DOM once, a long task that would otherwise freeze
 * the page's first animations. Events fired before then queue up.
 */
/** Keeps the page carrying the CSS of the style it shows. */
function StyleSheets() {
  useEffect(() => watchStyleCss(), []);
  return null;
}

function Analytics({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!(import.meta.env.PROD && posthogKey)) {
      return;
    }
    const start = () => posthog.init(posthogKey, POSTHOG_OPTIONS);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(start, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(start, 2000);
    return () => clearTimeout(id);
  }, []);

  if (!(import.meta.env.PROD && posthogKey)) {
    return children;
  }
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
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
                <StyleSheets />
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
