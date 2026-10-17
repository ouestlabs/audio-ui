import { createFileRoute, Outlet } from "@tanstack/react-router";

/** The docs read in a column with room at its sides. */
export const Route = createFileRoute("/_site/docs")({
  component: () => (
    <div className="flex-1 px-4 sm:px-8">
      <Outlet />
    </div>
  ),
});
