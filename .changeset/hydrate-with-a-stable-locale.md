---
"@audio-ui/react": patch
---

Knob, XYPad, Envelope, Meter and Plot format numbers with a fixed language during server rendering and hydration, then with the browser's, so a page rendered on the server no longer hydrates with a different `aria-valuetext` (such as "1 000" against "1,000"). A `locale` prop still wins.
