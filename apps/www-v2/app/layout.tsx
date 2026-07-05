import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Analytics } from "@/components/analytics";
import { JsonLd } from "@/components/json-ld";
import { QueryProvider } from "@/components/query-provider";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { META_THEME_COLORS, siteConfig } from "@/lib/config";

import { fontMono, fontSans, fontSerif, inter } from "@/lib/fonts";
import {
  buildOrganizationJsonLd,
  buildPageSocialMetadata,
  buildWebSiteJsonLd,
  getSiteAuthors,
  getSiteUrl,
} from "@/lib/seo";
import { cn } from "@/lib/utils";

import "@/styles/globals.css";

const appUrl = getSiteUrl();
export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: siteConfig.metadata.titleTemplate,
  },
  metadataBase: new URL(appUrl),
  alternates: {
    canonical: "/",
  },
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
  authors: getSiteAuthors(),
  creator: siteConfig.name,
  publisher: siteConfig.name,
  ...buildPageSocialMetadata({
    title: siteConfig.name,
    description: siteConfig.description,
    path: "/",
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
      className={cn(inter.variable, "overscroll-none")}
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
        <ThemeProvider>
          <QueryProvider>
            <NuqsAdapter>
              {children}
              <TailwindIndicator />
              <Toaster position="top-center" />
            </NuqsAdapter>
            <Analytics />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
