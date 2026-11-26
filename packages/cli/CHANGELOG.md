# @audio-ui/cli

## 0.2.0

### Minor Changes

- a25260c: `add skin-hardware` and `add skin-neu` write the skin's plain sheet, `css/skin-<name>.css`, in every framework, React included, and import it last in `css/index.css`. A sheet added later still goes before the skins, so a skin always draws over the elements.

## 0.1.0

### Minor Changes

- 01cde07: The CLI, `npx @audio-ui/cli add <name>` (the command `audio-ui` once installed): copies a component into a React, Vue, Svelte or plain web project, with its primitive, its adapter for the project's framework and, outside React, the sheet it is drawn by. It finds the framework, the import alias and the package manager, keeps them in `audio-ui.json`, installs the packages the files import, and never replaces a file the project changed without `--overwrite`.
