# audio/ui lab

The devices built with audio/ui, running on the sources of this repository: a TanStack Start app on Cloudflare, at https://lab.audio-ui.dev.

```sh
bun run dev      # http://localhost:3000
bun run build    # the packages, the social images, then the site
```

## A device is a folder

`src/components/devices/<slug>/` is a device. Adding the folder adds its page, its card, its link in the sidebar, its place in the command menu and in the sitemap: nothing else to write.

What the lab reads, at the root of the folder:

- `meta.json`: `title`, `description`, `category`, `uses` (the audio/ui components it is made of) and, optionally, `collection` (a series the gallery can show on its own, such as `"shadcn styles"`)
- `index.tsx`: the device, as the default export, with its own `h1`. It only composes the panel
- `index.css` (optional): its style
- `preview.png` (optional): a capture, 1200x630, for its card and its social image

What a device keeps for itself, by role, with the same names in each one:

- `audio/`: the sound, with no React (`engine.ts`, and what it plays)
- `ui/`: the pieces of its panel
- `use-<name>.ts`: what the panel reads and calls, which joins `ui/` to `audio/`

## How `src/` is grouped

As in the docs site (`apps/www`), by what each part does for the person using the lab, two levels deep at most:

```
src/
├── routes/                  the pages: /, /$device, the sitemap and robots.txt
├── components/
│   ├── site/                the chrome around every page
│   │   ├── layout/          shell (the sidebars and the frame), frame, frame-bar
│   │   ├── navigation/      sidebar, command-menu, mode-switcher
│   │   ├── details/         panel: the details of the device on the right
│   │   ├── gallery/         filters: the home's search, collections and categories
│   │   └── providers/       lab-provider: what the chrome's parts share
│   ├── code/                reading a device's code: source-dialog, file-tree, highlighted-code
│   ├── devices/             the devices themselves, a folder each
│   ├── audio-ui/            installed from the registry (shadcn add @audio-ui/...)
│   └── ui/                  shadcn, as it comes: never move or restyle it here
├── hooks/                   the lab's own, and the registry's (use-master-bus, use-midi-input)
└── lib/                     the device catalog (`devices.ts`), SEO, the highlighter, and the registry's web-audio
```

- A component goes where its reader looks for it, not where its imports come from: the command menu is navigation even though it reads the chrome's state.
- `ui/`, `audio-ui/`, `hooks/` and the registry's files in `lib/` sit where the shadcn CLI writes them. Their paths are its contract.
- Between folders, imports use the `@/` alias; inside one, a relative path.
