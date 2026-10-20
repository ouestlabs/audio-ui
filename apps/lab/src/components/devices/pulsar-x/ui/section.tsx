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
    <section className="pulsar-section">
      <h2 className="pulsar-legend">{title}</h2>
      {children}
    </section>
  );
}
