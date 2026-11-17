import { createFileRoute, redirect } from "@tanstack/react-router";

/** The catalog's old address, still linked from outside, goes to its page in the docs. */
export const Route = createFileRoute("/_site/components")({
  beforeLoad: () => {
    throw redirect({
      params: { _splat: "components" },
      replace: true,
      statusCode: 301,
      to: "/docs/$",
    });
  },
});
