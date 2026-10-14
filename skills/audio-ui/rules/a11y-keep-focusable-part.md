---
title: Keep the focusable part
impact: HIGH
impactDescription: keyboard and screen reader access survive restyling
tags: accessibility, render, thumb
---

## Keep the focusable part

The thumb holds the input that the keyboard and screen readers reach. Replacing it with a `div` keeps the look and loses the control.

**Incorrect:**

```tsx
<Fader.Control>
  <div className="my-thumb" style={{ bottom: `${percent}%` }} />
</Fader.Control>
```

**Correct:**

```tsx
<Fader.Control>
  <Fader.Thumb render={(props, state) => <MyThumb {...props} active={state.dragging} />} />
</Fader.Control>
```

`render` takes an element (`render={<span />}`) or a function of `(props, state)`. Always spread `props`.
