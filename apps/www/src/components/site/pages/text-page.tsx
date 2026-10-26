import type { ReactNode } from "react";

/** A page of prose, set as a docs page is: the About, Contact and Privacy pages. */
export function TextPage({
  children,
  lead,
  title,
}: {
  children: ReactNode;
  lead: string;
  title: string;
}) {
  return (
    <div className="flex-1 px-4 sm:px-8">
      <article className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-8 px-4 py-6 text-[1.05rem] text-neutral-800 sm:text-[15px] md:px-0 lg:py-8 dark:text-neutral-300">
        <div className="flex flex-col gap-2">
          <h1 className="scroll-m-20 font-semibold text-4xl tracking-tight sm:text-3xl xl:text-4xl">
            {title}
          </h1>
          <p className="text-[1.05rem] text-site-muted-foreground sm:text-base">
            {lead}
          </p>
        </div>
        <div className="typeset typeset-changelog w-full">{children}</div>
      </article>
    </div>
  );
}
