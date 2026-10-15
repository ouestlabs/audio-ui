## What and why

<!-- What changes, and what it fixes or enables. Link the issue if there is one. -->

## Checklist

- [ ] A changeset (`bun run changeset`) if `packages/core` or `packages/ui` changed in a way users see
- [ ] `bun run registry:build` from `apps/www`, after the last lint fix, if the registry changed
- [ ] `bun run skill:build` and the docs updated if a registry item, entry or prop the shipped skill names was renamed
- [ ] `bunx biome ci packages/core packages/ui`, the tests and `bun run typecheck` of what I touched pass
- [ ] For UI changes: checked in the browser and with the keyboard
