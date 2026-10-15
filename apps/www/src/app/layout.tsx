import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";
import { Provider as JotaiProvider } from "jotai";
import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { DESIGN_SYSTEM_BOOT_SCRIPT } from "@/app/(create)/lib/boot-cache";
import { JsonLd } from "@/components/json-ld";
import { QueryProvider } from "@/components/query-provider";
import { SiteCustomizer } from "@/components/site-customizer";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { META_THEME_COLORS, siteConfig } from "@/lib/config";

import { fontMono, fontSans, fontSerif } from "@/lib/fonts";
import {
  buildAuthorJsonLd,
  buildOrganizationJsonLd,
  buildPageSocialMetadata,
  buildWebSiteJsonLd,
  getSiteAuthors,
  getSiteUrl,
} from "@/lib/seo";
import { cn } from "@/lib/utils";

import "@/styles/globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const appUrl = getSiteUrl();
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  authors: getSiteAuthors(),
  creator: siteConfig.name,
  description: siteConfig.description,
  keywords: [
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
  ],
  metadataBase: new URL(appUrl),
  publisher: siteConfig.name,
  robots: {
    follow: true,
    index: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  title: {
    default: siteConfig.name,
    template: siteConfig.metadata.titleTemplate,
  },
  ...buildPageSocialMetadata({
    description: siteConfig.description,
    path: "/",
    title: siteConfig.name,
  }),
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={cn(
        "overscroll-none",
        "no-scrollbar",
        "font-sans",
        inter.variable
      )}
      data-scroll-behavior="smooth"
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: necessary for setting theme color based on user preference
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                }
                if (localStorage.layout) {
                  document.documentElement.classList.add('layout-' + localStorage.layout)
                }
              } catch (_) {}
            `,
          }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: puts the saved design system back before the first paint
          dangerouslySetInnerHTML={{ __html: DESIGN_SYSTEM_BOOT_SCRIPT }}
        />
        {/* A hoisted resource (href, precedence): React leaves it out of hydration, so the style the boot script adds to the head does not trip it. */}
        <style href="highlight-theme" precedence="default">
          {createThemeCss({
            dark: githubDarkTheme,
            darkSelector: ".dark",
            light: githubLightTheme,
          })}
        </style>
        <meta content={META_THEME_COLORS.light} name="theme-color" />
      </head>

      <body
        className={cn(
          fontSans.variable,
          fontSerif.variable,
          fontMono.variable,
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
                {children}
                <Suspense>
                  <SiteCustomizer />
                </Suspense>
                <TailwindIndicator />
                <Toaster position="top-center" />
              </JotaiProvider>
            </NuqsAdapter>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
