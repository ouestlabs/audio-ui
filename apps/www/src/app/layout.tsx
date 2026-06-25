import "../styles/globals.css";

import { Inter } from "next/font/google";
import { SiteHeader } from "@/components/layouts/global/headers/site";
import { fontMono, fontSans, fontSerif } from "@/lib/fonts";
import {
  createMetadata,
  createViewport,
  META_THEME_COLORS,
} from "@/lib/metadata";
import { cn } from "@/registry/bases/base/lib/utils";
import { Providers } from "./_providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = createMetadata();
export const viewport = createViewport();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={cn("font-sans", inter.variable)}
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
        className={cn(fontSans.variable, fontSerif.variable, fontMono.variable)}
      >
        <Providers>
          <div className="before:-z-10 relative flex min-h-svh flex-col overflow-clip [--header-height:4rem] before:pointer-events-none before:absolute before:inset-0 before:bg-sidebar">
            <SiteHeader />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
