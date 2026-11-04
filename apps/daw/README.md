# audio/ui DAW

A digital audio workstation in the browser, built on audio/ui only: the published packages (`@audio-ui/core`, `@audio-ui/react`) and the registry, installed with the shadcn CLI as any project would. It exists to put audio/ui under the load of a real product; what it needs and does not find is fixed where it lives, never worked around here. [docs/daw-spec](../../docs/daw-spec) holds the behavior it must keep, rule by rule, and the gaps it found.

TanStack Start on Cloudflare, at https://daw.audio-ui.dev (the Worker `audio-ui-daw`).

```sh
bun run dev            # http://localhost:3300
bun run build          # the packages, then the app, prerendered
bun test               # its own logic
bun run test:browser   # end to end in Chromium, against the dev server
```

## What is ours and what is installed

```
src/
├── routes/              the one page: it opens the project kept in the browser, or a new one
├── components/
│   ├── daw/             the workstation: library, arrangement, mixer, devices, clip editor, top bar, engine line
│   ├── site/            the theme switch, as lab and www have it
│   ├── audio-ui/        installed from the registry: never edited here
│   └── ui/              shadcn, as it comes
├── hooks/               installed from the registry (use-arrangement, use-arrangement-engine, use-audio-levels)
└── lib/
    ├── daw/             the project (new project, storage, dropped files, shortcuts)
    └── *.ts             installed from the registry (the arrangement and its engine, the clip player, the mixer…)
```

- The sound is `arrangement-engine` from the registry, playing the document `use-arrangement` holds. The interface never touches the audio: it sends commands to the document, and the engine follows it.
- `audio-ui/`, `ui/`, `hooks/` and the registry's files in `lib/` stay as the CLI writes them. A change they need goes to the registry, then is installed again.
- The page is cross-origin isolated (`public/_headers`, and `src/start.ts` in development), so the engine shares recordings with its worklets in shared memory.
- The project is kept in the browser's private storage (OPFS): the document, and the bytes of every file it plays.

## Installing a registry change before it is deployed

`components.json` points at the deployed registry. While a fix to the registry is on a branch, install it from this checkout's build:

```sh
(cd ../www && bun run registry:build)
bun run registry:local arrangement-engine timeline
```

The script serves `apps/www/public`, points `components.json` at it for one `shadcn add`, and puts it back. Once the fix is deployed, `bunx shadcn@latest add @audio-ui/<name>` writes the same files.
