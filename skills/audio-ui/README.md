# audio/ui agent skill

The skill coding agents use to build audio interfaces with audio/ui. People install it with:

```bash
npx skills add ouestlabs/audio-ui
```

## Structure

- `SKILL.md`: what agents load first: when to apply, rule categories by priority, the quick reference, component selection and the workflow
- `rules/`: one rule per file
  - `_sections.md`: the categories, their order, impact and description
  - `_template.md`: the shape of a new rule
  - `<prefix>-<name>.md`: a rule, with an incorrect and a correct example
- `AGENTS.md`: every rule expanded in one document, for agents without skill support (**generated**)
- `components.md`, `setup.md`, `core.md`: the catalog; setup for the registry, the packages and the MCP server; the framework-free controllers outside React
- `design.md`, `directions.md`, `taste.md`, `hardware.md`, `styles/`: choosing a visual direction, and the CSS skins (retro, minimal, modern, tape, phosphor, hifi, brutalist, y2k, console, synth70) and the materials they are composed from with the verified markup; a test renders the markup and checks every class
- `metadata.json`: version, organization, abstract and references used in `AGENTS.md`
- `evals/evals.json`: prompts with checkable expectations, to measure the skill against a model
- `agents/openai.yml`, `assets/`: how Codex displays the skill

## Adding a rule

1. Copy `rules/_template.md` to `rules/<prefix>-<name>.md`. The prefix is a section from `rules/_sections.md`: `audio-`, `live-`, `values-`, `a11y-`, `core-`, `design-`, `style-` or `ai-`.
2. Fill in the frontmatter (`title`, `impact`, `impactDescription`, `tags`), the explanation, and an incorrect and a correct example that use the real audio/ui API.
3. List the rule in the Quick Reference of `SKILL.md`, under its section.
4. From `apps/www`: `bun run skill:build`, then `bun test test/skills.test.ts`.

## What CI checks

`apps/www/test/skills.test.ts` fails when:

- a rule's frontmatter, prefix, heading or examples are missing or wrong
- a rule is missing from the Quick Reference, or the Quick Reference names a rule that doesn't exist
- `AGENTS.md` is not the output of `bun run skill:build`
- the skill names a registry item, an `@audio-ui/react` entry, a data attribute or a CSS variable that doesn't exist in the code
- a relative link, an icon, the evals or the version in `SKILL.md` and `metadata.json` disagree
