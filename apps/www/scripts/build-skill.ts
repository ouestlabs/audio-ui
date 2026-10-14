/**
 * Compiles the audio/ui agent skill's rules (`skills/audio-ui/rules/*.md`)
 * into `skills/audio-ui/AGENTS.md`, the single document agents without skill
 * support read, and validates the rules on the way. `test/skills.test.ts`
 * fails when the compiled file is stale or a rule is malformed.
 *
 *   bun run skill:build
 */

export const SKILL_DIR = `${import.meta.dir}/../../../skills/audio-ui`;

const IMPACTS = [
  "CRITICAL",
  "HIGH",
  "MEDIUM-HIGH",
  "MEDIUM",
  "LOW-MEDIUM",
  "LOW",
] as const;
type Impact = (typeof IMPACTS)[number];

const RULE_FILES = new Bun.Glob("[!_]*.md");
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const SECTION_HEADING = /^## (\d+)\. (.+) \(([a-z0-9]+)\)$/gm;
const SECTION_IMPACT = /\*\*Impact:\*\* ([A-Z-]+)/;
const SECTION_DESCRIPTION = /\*\*Description:\*\* ([\s\S]+?)(?:\n\n|$)/;
const CODE_FENCE = /^```/m;
const NOT_SLUG = /[^a-z0-9 -]/g;
const SPACES = / /g;
const LINE_BREAK = /\s*\n\s*/g;
// A link written from `rules/`, which AGENTS.md (one folder up) must point at from the skill's root.
const RULE_RELATIVE_LINK = /\]\(\.\.\//g;

export interface Section {
  description: string;
  id: string;
  impact: Impact;
  number: number;
  title: string;
}

export interface Rule {
  body: string;
  file: string;
  id: string;
  impact: Impact;
  impactDescription: string;
  section: string;
  tags: string[];
  title: string;
}

interface Metadata {
  abstract: string;
  date: string;
  organization: string;
  references: string[];
  version: string;
}

const isImpact = (value: unknown): value is Impact =>
  IMPACTS.includes(value as Impact);

const slug = (text: string) =>
  text.toLowerCase().replace(NOT_SLUG, "").replace(SPACES, "-");

export async function readSections(dir = SKILL_DIR): Promise<Section[]> {
  const text = await Bun.file(`${dir}/rules/_sections.md`).text();
  const headings = [...text.matchAll(SECTION_HEADING)];
  return headings.map((match, index) => {
    const block = text.slice(
      match.index,
      headings[index + 1]?.index ?? text.length
    );
    const impact = block.match(SECTION_IMPACT)?.[1];
    if (!isImpact(impact)) {
      throw new Error(`_sections.md: section ${match[2]} has no valid impact`);
    }
    return {
      description: (block.match(SECTION_DESCRIPTION)?.[1] ?? "")
        .replace(LINE_BREAK, " ")
        .trim(),
      id: match[3] ?? "",
      impact,
      number: Number(match[1]),
      title: match[2] ?? "",
    };
  });
}

/** What is wrong with one rule file, if anything. */
function checkRule(
  file: string,
  data: Record<string, unknown>,
  body: string,
  sectionIds: Set<string>
): string[] {
  const title = String(data.title ?? "");
  const section = file.split("-")[0] ?? "";
  const checks: [boolean, string][] = [
    [Boolean(title), "missing title"],
    [isImpact(data.impact), `impact must be one of ${IMPACTS.join(", ")}`],
    [Boolean(data.impactDescription), "missing impactDescription"],
    [Boolean(data.tags), "missing tags"],
    [sectionIds.has(section), `prefix "${section}" is not a section`],
    [body.startsWith(`## ${title}`), `body must start with "## ${title}"`],
    [
      body.includes("**Incorrect") && body.includes("**Correct"),
      "needs an Incorrect and a Correct example",
    ],
    [CODE_FENCE.test(body), "needs a code example"],
  ];
  return checks
    .filter(([passes]) => !passes)
    .map(([, problem]) => `${file}: ${problem}`);
}

/** Reads every rule and returns them with the problems found in each. */
export async function readRules(
  dir = SKILL_DIR,
  sections?: Section[]
): Promise<{ errors: string[]; rules: Rule[] }> {
  const sectionIds = new Set(
    (sections ?? (await readSections(dir))).map((section) => section.id)
  );
  const files = (
    await Array.fromAsync(RULE_FILES.scan({ cwd: `${dir}/rules` }))
  ).sort();
  const texts = await Promise.all(
    files.map((file) => Bun.file(`${dir}/rules/${file}`).text())
  );
  const errors: string[] = [];
  const rules: Rule[] = [];

  for (const [index, file] of files.entries()) {
    const text = texts[index] ?? "";
    const match = text.match(FRONTMATTER);
    if (!match) {
      errors.push(`${file}: missing frontmatter`);
      continue;
    }
    const data = Bun.YAML.parse(match[1] ?? "") as Record<string, unknown>;
    const title = String(data.title ?? "");
    const body = text.slice(match[0].length).trim();
    errors.push(...checkRule(file, data, body, sectionIds));
    rules.push({
      body: body.slice(`## ${title}`.length).trim(),
      file,
      id: file.replace(".md", ""),
      impact: isImpact(data.impact) ? data.impact : "LOW",
      impactDescription: String(data.impactDescription ?? ""),
      section: file.split("-")[0] ?? "",
      tags: String(data.tags ?? "")
        .split(",")
        .map((tag) => tag.trim()),
      title,
    });
  }
  return { errors, rules };
}

/** Rules of a section, most impactful first, then by title. */
export function rulesOf(rules: Rule[], section: Section): Rule[] {
  return rules
    .filter((rule) => rule.section === section.id)
    .sort(
      (a, b) =>
        IMPACTS.indexOf(a.impact) - IMPACTS.indexOf(b.impact) ||
        a.title.localeCompare(b.title)
    );
}

export async function compileSkill(dir = SKILL_DIR): Promise<string> {
  const metadata: Metadata = await Bun.file(`${dir}/metadata.json`).json();
  const sections = await readSections(dir);
  const { rules } = await readRules(dir, sections);

  const toc = sections.flatMap((section) => [
    `${section.number}. [${section.title}](#${slug(`${section.number} ${section.title}`)}): **${section.impact}**`,
    ...rulesOf(rules, section).map((rule, index) => {
      const number = `${section.number}.${index + 1}`;
      return `   - ${number} [${rule.title}](#${slug(`${number} ${rule.title}`)})`;
    }),
  ]);

  const body = sections.map((section) =>
    [
      `## ${section.number}. ${section.title}`,
      `**Impact: ${section.impact}**`,
      section.description,
      ...rulesOf(rules, section).map((rule, index) =>
        [
          `### ${section.number}.${index + 1} ${rule.title}`,
          `**Impact: ${rule.impact} (${rule.impactDescription})**`,
          rule.body.replace(RULE_RELATIVE_LINK, "](./"),
        ].join("\n\n")
      ),
    ].join("\n\n")
  );

  return `${[
    "# audio/ui",
    `**Version ${metadata.version}**  \n${metadata.organization}  \n${metadata.date}`,
    "> **Note:**  \n> This document is for agents and LLMs building audio interfaces with audio/ui. It is generated from `rules/` by `bun run skill:build` in `apps/www`: edit the rules, not this file.",
    "---",
    `## Abstract\n\n${metadata.abstract}`,
    "---",
    `## Table of Contents\n\n${toc.join("\n")}`,
    "---",
    body.join("\n\n---\n\n"),
    "---",
    `## References\n\n${metadata.references.map((url, index) => `${index + 1}. ${url}`).join("\n")}`,
  ].join("\n\n")}\n`;
}

if (import.meta.main) {
  const { errors } = await readRules();
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  await Bun.write(`${SKILL_DIR}/AGENTS.md`, await compileSkill());
  console.log("skills/audio-ui/AGENTS.md written");
}
