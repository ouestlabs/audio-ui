# audio-ui

Adds [audio/ui](https://www.audio-ui.dev) components to a React, Vue, Svelte or plain web project. The files are copied into the project, and they are yours.

```bash
npx audio-ui add knob
```

It writes the headless primitive, its adapter for the project's framework and the styled component. Outside React it also writes the sheet the component is drawn by, plain CSS on its parts, with an `index.css` to import once at the root of the app. It installs the packages the files import with the project's package manager.

| Framework | `npx audio-ui add knob` writes |
| --- | --- |
| React | `components/audio-ui/knob.tsx`, Tailwind classes |
| Vue | `components/audio-ui/knob/Knob.vue` and `css/knob.css` |
| Svelte | `src/lib/components/audio-ui/knob/Knob.svelte` and `css/knob.css` |
| Web | `components/audio-ui/knob/web.ts`, the custom elements, and `css/knob.css` |

## Options

```
--headless           the primitive alone, with no style
--framework <name>   react, vue, svelte or web (found in package.json)
--style <name>       the style to draw the components in (nova by default)
--overwrite          replace the files of the project that differ
--no-install         print the package manager's command instead of running it
--cwd <dir>          the project's root (the current folder)
--registry <url>     another registry, or a folder holding a copy of one
```

The framework, the style and the import alias are kept in `audio-ui.json` after the first `add`. A file the project changed is never replaced without `--overwrite`.

Docs: [audio-ui.dev/docs/cli](https://www.audio-ui.dev/docs/cli)

## License

MIT
