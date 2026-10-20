import type { ReactNode } from "react";

/** A labelled part of the panel. */
export function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="mira-section">
      <h2 className="mira-legend">{title}</h2>
      {children}
    </section>
  );
}
