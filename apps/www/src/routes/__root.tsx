import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import globalsCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  component: RootDocument,
  head: () => ({
    links: [{ href: globalsCss, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
    ],
  }),
});

function RootDocument() {
  return (
    <html className="dark" lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
