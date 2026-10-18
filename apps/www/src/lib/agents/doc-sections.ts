/**
 * The `## ` sections of a page's markdown, so an agent can ask for one part of
 * a long page. A section runs from its heading to the next `## ` heading, its
 * `###` subsections included. Fenced code is skipped: a `## ` inside it is text.
 */

const FENCE = /^(```|~~~)/;
const H2 = /^## (.+?)\s*$/;

/** A heading as a section name: `API reference` is `api-reference`. */
export function sectionSlug(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The sections of a page: each with its heading, its slug and the lines it holds, heading first. */
export function readSections(markdown: string) {
  const found: { heading: string; lines: string[]; slug: string }[] = [];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (FENCE.test(line)) {
      fenced = !fenced;
    }
    const heading = fenced ? null : H2.exec(line);
    if (heading) {
      const title = heading[1] ?? "";
      found.push({ heading: title, lines: [line], slug: sectionSlug(title) });
    } else {
      found.at(-1)?.lines.push(line);
    }
  }
  return found;
}

/** The slugs of a page's sections, in order. */
export function sectionNames(markdown: string) {
  return readSections(markdown).map((section) => section.slug);
}

/** The Markdown of the section with this slug, or nothing when the page has none. */
export function pickSection(markdown: string, slug: string) {
  const section = readSections(markdown).find((item) => item.slug === slug);
  return section?.lines.join("\n").trimEnd();
}
