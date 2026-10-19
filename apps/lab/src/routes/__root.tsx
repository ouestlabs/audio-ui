import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "next-themes";
import { LabShell } from "@/components/site/layout/shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE } from "../lib/seo";

import appCss from "../styles/globals.css?url";

/**
 * Run in the head, before anything is painted: notes which sidebars were left
 * shut (the navigation) or open (the details) on the page itself, so the page
 * is drawn that way from the start and nothing opens then closes while it
 * loads. The keys are the ones `usePersistedState` writes.
 */
const LAYOUT_BOOT_SCRIPT = `(function(){try{var r=document.documentElement;if(localStorage.getItem("lab:navigation")==="false")r.setAttribute("data-nav-closed","");if(localStorage.getItem("lab:details")==="true")r.setAttribute("data-details-open","")}catch(_){}})()`;

const HIGHLIGHT_THEME_CSS = createThemeCss({
  dark: githubDarkTheme,
  darkSelector: ".dark",
  light: githubLightTheme,
});

export const Route = createRootRoute({
  head: () => ({
    scripts: [{ children: LAYOUT_BOOT_SCRIPT }],
    styles: [{ children: HIGHLIGHT_THEME_CSS }],
    links: [
      { href: appCss, rel: "stylesheet" },
      { href: "/icon.svg", rel: "icon", type: "image/svg+xml" },
      { href: "/icon.png", rel: "icon", sizes: "512x512", type: "image/png" },
      { href: "/apple-icon.png", rel: "apple-touch-icon" },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      {
        content: SITE.themeColor.light,
        media: "(prefers-color-scheme: light)",
        name: "theme-color",
      },
      {
        content: SITE.themeColor.dark,
        media: "(prefers-color-scheme: dark)",
        name: "theme-color",
      },
      { content: "audio/ui", name: "author" },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});

function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-10">
      <h1 className="font-semibold text-2xl">Device not found</h1>
      <p className="text-muted-foreground">
        This address is not a device of the lab.{" "}
        <Link className="underline" to="/">
          See all devices
        </Link>
        .
      </p>
    </div>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableColorScheme
          enableSystem
        >
          <TooltipProvider>
            <LabShell>{children}</LabShell>
          </TooltipProvider>
        </ThemeProvider>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
