import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "../components/layout/app-layout.tsx";
import { SITE } from "../lib/seo.ts";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    links: [
      { href: appCss, rel: "stylesheet" },
      { href: "/icon.svg", rel: "icon", type: "image/svg+xml" },
      { href: "/icon.png", rel: "icon", sizes: "512x512", type: "image/png" },
      { href: "/apple-icon.png", rel: "apple-touch-icon" },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { content: SITE.themeColor, name: "theme-color" },
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
      <p className="text-white/60">
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
    <html className="dark" lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <TooltipProvider>
          <AppLayout>{children}</AppLayout>
        </TooltipProvider>
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
