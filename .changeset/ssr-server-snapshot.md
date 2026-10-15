---
"@audio-ui/react": patch
---

Every primitive renders on the server again: Knob, Fader, XYPad, Envelope, Piano, Plot's handle, Timeline (root, track, clip, range) and Waveform (root, region) read their state through a store that had no server snapshot, so a framework prerendering client components, such as Next.js at build time, failed with "Missing getServerSnapshot". They now give the server the same snapshot as the client.
