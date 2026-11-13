---
"@audio-ui/gl": patch
---

Lane: a lane clears its whole canvas before it draws. The renderers leave the scissor test on, cut to the last part they drew, so a clear only cleared that part: a stereo waveform kept the picture of the frames before under its top row while it zoomed.
