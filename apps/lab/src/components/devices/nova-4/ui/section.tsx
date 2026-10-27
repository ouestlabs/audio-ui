import type { ReactNode } from "react";

/** A labelled part of the panel, its title printed over a thin rule. */
export function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="nova-section">
      <h2 className="nova-legend">{title}</h2>
      {children}
    </section>
  );
}
