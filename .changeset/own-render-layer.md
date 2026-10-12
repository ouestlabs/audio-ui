---
"@audio-ui/react": patch
---

Every part renders and merges its props with the package's own code: the `render` prop (an element, or a function of the props and the state), the `data-*` attributes drawn from each part's state, and the chaining of event handlers, class names and styles all behave as before, but no longer come from another library. Only `Fader` and `Meter` still rely on one, for now. The size budgets count this code since it is now part of each entry.
