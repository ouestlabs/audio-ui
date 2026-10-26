import type { ReactNode } from "react";

/** A labelled part of the panel, its title printed over the group. */
export function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="sera-section">
      <h2 className="sera-legend">{title}</h2>
      {children}
    </section>
  );
}
