---
title: Never edit the package
impact: LOW
impactDescription: upgrades keep working
tags: headless, upgrade, registry
---

## Never edit the package

Changes made inside `node_modules/@audio-ui/react` (or a fork of it) vanish on the next install and block every upgrade. The look lives in your code: either the headless parts styled by state, or the registry component copied into the project.

**Incorrect (patching the installed package):**

```bash
# lost on the next install, conflicts with every upgrade
sed -i 's/strokeWidth = 4/strokeWidth = 6/' node_modules/@audio-ui/react/dist/index.js
```

**Correct (style the parts, or own a copy):**

```tsx
<Knob.Indicator strokeWidth={6} /> // the part's own prop
```

```bash
npx shadcn@latest add @audio-ui/knob   # then edit components/audio-ui/knob.tsx: it belongs to the project
```
