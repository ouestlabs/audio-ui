# audio/ui agent skills

The skills coding agents use to build audio interfaces with audio/ui. They are four, so an agent loads only what the task needs. People install them with:

```bash
npx skills add ouestlabs/audio-ui
```

In Claude Code they install as one plugin (the repository's `.claude-plugin/marketplace.json` lists the four folders of `skills/` as the plugin `audio-ui`):

```text
/plugin install audio-ui --marketplace ouestlabs/audio-ui
```

| Skill | Job | Files |
| --- | --- | --- |
| `audio-ui` | Pick, install and wire the components | `components.md`, `setup.md`, rules `values-`, `a11y-`, `style-`, `ai-` |
| `web-audio` | Sound and live data | rules `audio-`, `live-` |
| `design` | How it looks | `design.md`, `directions.md`, `taste.md`, `hardware.md`, `styles/`, rules `design-` |
| `core` | Outside React | `core.md`, rules `core-` |

Skills refer to each other by name (the `design` skill), never by relative link, so each one still reads on its own when installed alone.

## Structure of a skill

- `SKILL.md`: what agents load first: when to apply, rule categories by priority, the quick reference, and the workflow
- `rules/`: one rule per file
  - `_sections.md`: the categories, their order, impact and description
  - `_template.md`: the shape of a new rule
  - `<prefix>-<name>.md`: a rule, with an incorrect and a correct example
- `AGENTS.md`: every rule of the skill expanded in one document, for agents without skill support (**generated**)
- `metadata.json`: version, organization, abstract and references used in `AGENTS.md`
- `evals/evals.json`: prompts with checkable expectations, to measure the skill against a model
- `agents/openai.yml`, `assets/`: how Codex displays the skill

## Adding a rule

1. Copy `rules/_template.md` to `<skill>/rules/<prefix>-<name>.md`. The skill is the one the prefix belongs to (table above), and the prefix is a section from its `rules/_sections.md`: `audio-`, `live-`, `values-`, `a11y-`, `core-`, `design-`, `style-` or `ai-`.
2. Fill in the frontmatter (`title`, `impact`, `impactDescription`, `tags`), the explanation, and an incorrect and a correct example that use the real audio/ui API.
3. List the rule in the Quick Reference of that skill's `SKILL.md`, under its section.
4. From `apps/www`: `bun run skill:build`, then `bun test test/skills.test.ts`.

## What CI checks

`apps/www/test/skills.test.ts` fails when:

- a rule's frontmatter, prefix, heading or examples are missing or wrong
- a rule is missing from the Quick Reference, or the Quick Reference names a rule that doesn't exist
- `AGENTS.md` is not the output of `bun run skill:build`
- the skill names a registry item, an `@audio-ui/react` entry, a data attribute or a CSS variable that doesn't exist in the code
- a relative link, an icon, the evals or the version in `SKILL.md` and `metadata.json` disagree
- a skill folder is missing from the plugin in `.claude-plugin/marketplace.json`, or the plugin lists one that doesn't exist
