---
title: Semantic tokens only
impact: MEDIUM
impactDescription: themes and dark mode keep working
tags: tokens, tailwind, theme
---

## Semantic tokens only

**Incorrect:**

```tsx
<div className="bg-zinc-900 text-green-400">
  <Meter className="[&_[data-clipping]]:bg-red-500" />
</div>
```

**Correct:**

```tsx
<div className="bg-card text-card-foreground">
  <Meter />  {/* clipping already uses the destructive token */}
</div>
```
