import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import appCss from "../styles/globals.css?url";

const SITE = "https://daw.audio-ui.dev";
const TITLE = "DAW · audio/ui";
const DESCRIPTION =
  "A digital audio workstation in the browser, built on audio/ui: arrangement, mixer, devices, export.";

export const Route = createRootRoute({
  head: () => ({
    links: [
      { href: appCss, rel: "stylesheet" },
      { href: "/icon.svg", rel: "icon", type: "image/svg+xml" },
      { href: "/icon.png", rel: "icon", sizes: "512x512", type: "image/png" },
      { href: "/apple-icon.png", rel: "apple-touch-icon" },
      { href: SITE, rel: "canonical" },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: TITLE },
      { content: DESCRIPTION, name: "description" },
      // What a shared link shows: the workstation playing its song.
      { content: "website", property: "og:type" },
      { content: SITE, property: "og:url" },
      { content: TITLE, property: "og:title" },
      { content: DESCRIPTION, property: "og:description" },
      { content: `${SITE}/og.png`, property: "og:image" },
      { content: "1200", property: "og:image:width" },
      { content: "630", property: "og:image:height" },
      {
        content: "The audio/ui DAW playing a song: arrangement and drum rack",
        property: "og:image:alt",
      },
      { content: "summary_large_image", name: "twitter:card" },
      { content: TITLE, name: "twitter:title" },
      { content: DESCRIPTION, name: "twitter:description" },
      { content: `${SITE}/og.png`, name: "twitter:image" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
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
          {children}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
