---
title: Edit your copy, never the package
impact: LOW
impactDescription: upgrades keep working
tags: headless, upgrade, registry
---

## Edit your copy, never the package

Changes made inside `node_modules` (the UI SDK kernel, `@ui-sdk/*`, or a fork of it) vanish on the next install and block every upgrade. The look lives in your code: the primitive, its adapter and the registry component are copied into the project, and they are yours to edit.

**Incorrect (patching the installed package):**

```bash
# lost on the next install, conflicts with every upgrade
sed -i 's/pointerType/button/' node_modules/@ui-sdk/core/dist/index.js
```

**Correct (style the parts, or own a copy):**

```tsx
<Knob.Indicator strokeWidth={6} /> // the part's own prop
```

```bash
npx shadcn@latest add @audio-ui/knob-react   # then edit components/audio-ui/knob/react.tsx: it belongs to the project
```
