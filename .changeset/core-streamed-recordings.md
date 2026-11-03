---
"@audio-ui/core": minor
---

Playback: a recording can be streamed instead of decoded whole into memory, for sets longer than a tab can hold. `createPagePool` and `createRecordingStream` keep pages of audio in memory a worker and a worklet can share, `PageCache` loads the pages asked for and gives up those asked for longest ago, and `pagesAhead` says which pages a track's clips will read over the next frames, loops, reverse and warp included. The renderer plays a `StreamedRecording` beside a decoded one, and a decoded one as fast as before.
