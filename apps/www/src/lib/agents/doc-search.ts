import { readSections } from "@/lib/agents/doc-sections";

/**
 * Full-text search over the component pages, one hit per section, so an agent
 * lands on the part of a page that answers its question and fetches only that.
 */

const NON_WORD = /[^a-z0-9]+/;
const SNIPPET_LENGTH = 200;
const MAX_COUNT_PER_TERM = 5;
const STOP_WORDS = new Set([
  "and",
  "are",
  "can",
  "for",
  "from",
  "how",
  "into",
  "that",
  "the",
  "this",
  "use",
  "what",
  "with",
  "you",
]);

export interface DocPage {
  markdown: string;
  name: string;
}

export interface DocHit {
  component: string;
  heading: string;
  score: number;
  section: string;
  snippet: string;
}

function termsOf(query: string) {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(NON_WORD)
        .filter((term) => term.length >= 2 && !STOP_WORDS.has(term))
    ),
  ];
}

function countOf(text: string, term: string) {
  return text.split(term).length - 1;
}

/** The line that holds the most terms, outside code fences and tags, cut to a short extract. */
function snippetOf(lines: string[], terms: string[]) {
  let best = "";
  let bestCount = 0;
  let fenced = false;
  for (const line of lines.slice(1)) {
    if (line.startsWith("```")) {
      fenced = !fenced;
    }
    const text = line.trim();
    if (fenced || text.startsWith("<") || text.length === 0) {
      continue;
    }
    const lower = text.toLowerCase();
    const count = terms.filter((term) => lower.includes(term)).length;
    if (count > bestCount) {
      best = text;
      bestCount = count;
    }
  }
  if (best.length <= SNIPPET_LENGTH) {
    return best;
  }
  const first = best
    .toLowerCase()
    .indexOf(terms.find((t) => best.toLowerCase().includes(t)) ?? "");
  const start = Math.max(0, first - SNIPPET_LENGTH / 4);
  return `${start > 0 ? "…" : ""}${best.slice(start, start + SNIPPET_LENGTH)}…`;
}

interface IndexedSection {
  body: string;
  component: string;
  heading: string;
  lines: string[];
  slug: string;
}

/** A rare term in the docs says more than a common one: its weight falls with the sections that hold it. */
function weightsOf(terms: string[], indexed: IndexedSection[]) {
  return terms.map((term) => {
    const holding = indexed.filter((entry) => entry.body.includes(term));
    return Math.log(1 + indexed.length / (1 + holding.length));
  });
}

/** How well a section answers the terms: a term in the heading or the page name counts more than one in the body, and each distinct term that matches adds more. */
function scoreOf(terms: string[], weights: number[], entry: IndexedSection) {
  const heading = entry.heading.toLowerCase();
  let score = 0;
  let matched = 0;
  terms.forEach((term, index) => {
    const inBody = Math.min(countOf(entry.body, term), MAX_COUNT_PER_TERM);
    const inHeading = heading.includes(term) ? 3 : 0;
    const inName = entry.component.includes(term) ? 4 : 0;
    if (inBody + inHeading > 0) {
      matched += 1;
    }
    score += (weights[index] ?? 1) * (inBody + inHeading + inName);
  });
  return matched > 0 ? score + matched * 5 : 0;
}

/** The sections that match the query, best first. */
export function searchDocs(pages: DocPage[], query: string, limit: number) {
  const terms = termsOf(query);
  const indexed = pages.flatMap((page) =>
    readSections(page.markdown).map((section) => ({
      body: section.lines.join("\n").toLowerCase(),
      component: page.name,
      heading: section.heading,
      lines: section.lines,
      slug: section.slug,
    }))
  );
  const weights = weightsOf(terms, indexed);
  return indexed
    .map((entry) => ({ entry, score: scoreOf(terms, weights, entry) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, score }) => ({
      component: entry.component,
      heading: entry.heading,
      score,
      section: entry.slug,
      snippet: snippetOf(entry.lines, terms),
    }));
}

function distance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        (row[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = row;
  }
  return previous[b.length] ?? 0;
}

/** Up to three known names close to a mistyped one: the same without hyphens, a name contained in the other, a typo. */
export function closest(name: string, known: string[]) {
  const wanted = name.trim().toLowerCase();
  const flat = wanted.replaceAll("-", "");
  if (flat.length === 0) {
    return [];
  }
  return known
    .map((candidate) => {
      let rank = distance(wanted, candidate);
      if (candidate.replaceAll("-", "") === flat) {
        rank = 0;
      } else if (candidate.includes(wanted) || wanted.includes(candidate)) {
        rank = 1;
      }
      return { candidate, rank };
    })
    .filter((item) => item.rank <= 2)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .map((item) => item.candidate);
}
