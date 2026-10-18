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

function sections(markdown: string) {
  const found: { lines: string[]; slug: string }[] = [];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (FENCE.test(line)) {
      fenced = !fenced;
    }
    const heading = fenced ? null : H2.exec(line);
    if (heading) {
      found.push({ lines: [line], slug: sectionSlug(heading[1] ?? "") });
    } else {
      found.at(-1)?.lines.push(line);
    }
  }
  return found;
}

/** The slugs of a page's sections, in order. */
export function sectionNames(markdown: string) {
  return sections(markdown).map((section) => section.slug);
}

/** The Markdown of the section with this slug, or nothing when the page has none. */
export function pickSection(markdown: string, slug: string) {
  const section = sections(markdown).find((item) => item.slug === slug);
  return section?.lines.join("\n").trimEnd();
}
