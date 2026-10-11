import { BASES } from "@/registry/bases";

/** The library a preview is built on: the only one there is for now. */
export function BuiltOn() {
  const base = BASES.find((item) => item.name === "base");
  const logo = base?.meta?.logo;
  return (
    <>
      {typeof logo === "string" ? (
        <span
          aria-hidden
          className="size-3.5 shrink-0 [&_svg]:size-3.5"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the logo is our own registry's SVG.
          dangerouslySetInnerHTML={{ __html: logo }}
        />
      ) : null}
      <span className="truncate">{base?.title}</span>
    </>
  );
}
