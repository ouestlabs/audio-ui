# @audio-ui/cli

## 0.1.0

### Minor Changes

- 01cde07: The CLI, `npx @audio-ui/cli add <name>` (the command `audio-ui` once installed): copies a component into a React, Vue, Svelte or plain web project, with its primitive, its adapter for the project's framework and, outside React, the sheet it is drawn by. It finds the framework, the import alias and the package manager, keeps them in `audio-ui.json`, installs the packages the files import, and never replaces a file the project changed without `--overwrite`.
