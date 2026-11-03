---
"@audio-ui/core": minor
---

Device: an instrument's `noteOn(note, timing?)` and `noteOff(timing?)` take an optional `NoteTiming`, `{ at, id }`. `at` is a time of the audio clock, so a host that schedules notes ahead plays them on the frame they fall at instead of when its timer fires; `id` names the note, so a `noteOff` for a note that another one took over from lets nothing go. With no timing, both act now on the held note, as before.
