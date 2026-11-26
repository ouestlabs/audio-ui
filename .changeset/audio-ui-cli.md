---
"audio-ui": minor
---

The `audio-ui` CLI: `npx audio-ui add <name>` copies a component into a React, Vue, Svelte or plain web project, with its primitive, its adapter for the project's framework and, outside React, the sheet it is drawn by. It finds the framework, the import alias and the package manager, keeps them in `audio-ui.json`, installs the packages the files import, and never replaces a file the project changed without `--overwrite`.
