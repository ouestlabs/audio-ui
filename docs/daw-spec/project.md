# Projects and files

Keeping the work. The reference saves a set to a file and gathers its samples into a project folder. `apps/daw` keeps the project in the browser's private storage as you go, and from phase 2 saves it to a folder of the disk as well, in a format of its own: a project folder holding a `.audioui` document and its samples.

### PRJ-001 Saved as you go
Every change is saved within a second, with the audio files it uses; reloading the page brings the project back as it was. So does how it was laid out, kept in this browser, apart from the document and from undo: the zoom and the scroll, the grid, the start marker, the track selected, tracks and devices folded and the heights set by hand, the library's shelf and whether it is open, the panel's view, height and fold, a rack's macros, zones and picked chain, a drum rack's picked pad, the clip panel's boxes and pen, and the metronome and the record settings. Monitoring stays off and the input goes back to the default, so a reload never starts a mic into the speakers, or fails on an input since unplugged. Opening another project forgets it.
Deviation: the reference saves on command. Nothing here is lost on a reload.
Test: apps/daw/test/browser/run.ts "PRJ-001"

### PRJ-002 The project keeps its files
An audio file dropped in is copied into the project's storage once: the project still plays after the original file is moved or deleted.
Test: apps/daw/test/project.test.ts "PRJ-002"

### PRJ-003 Undo does not outlive the page
The undo history starts empty when the project is opened again, as in the reference.
Test: apps/daw/test/project.test.ts "PRJ-003"

### PRJ-004 Out of room
When the browser refuses to store more, the app says how much the project holds and keeps playing what is loaded; nothing already saved is lost.
Test: apps/daw/test/project.test.ts "PRJ-004"

### PRJ-005 Opening sets of the reference DAW
**Withdrawn**: a project is made in the app, from audio files dropped on it; another program's set files are not read.

### PRJ-006 The project folder
A project on disk is a folder named after it: `<name>.audioui`, the document, and `Samples/`, the audio files it plays, as they were dropped in. The document is UTF-8 JSON with a `format` and a `version` at its top, and names each sample by its path in `Samples/`; a version it does not know is refused with a message, never half read. The decoded audio the engine streams from (G-013) is a cache in the browser's storage, made again from the recording's file when it is missing. A project opened gives its recordings new ids, so they never meet those the page already played; when the page opens again, the caches and files of recordings the project no longer has are let go.
Test: apps/daw/test/project-file.test.ts "PRJ-006"; apps/daw/test/browser/run.ts "PRJ-006 and PRJ-007"

### PRJ-007 Open and save on disk
Cmd+O opens a project folder, Cmd+S saves to the folder the project came from (asking for one the first time), Cmd+Shift+S saves a copy to another folder, which the project then belongs to. A save writes the document and only the samples the folder lacks. Saving to disk is for browsers that can write a folder the user picks (Chromium); elsewhere the project stays in the browser's storage and can be exported, and these keys stay the browser's. The folder is remembered across reloads; the first save after one asks the browser's leave to write there again. Opening a folder replaces the project in the browser's storage: the one there before is not kept anywhere else unless it was saved.
Test: apps/daw/test/project-file.test.ts "PRJ-007"; apps/daw/test/browser/run.ts "PRJ-006 and PRJ-007"

### PRJ-008 Projects of other DAWs, through DAWproject
A project goes out as a `.dawproject` file (the open exchange format: a zip of `project.xml`, `metadata.xml` and the audio) and one comes in from it: tracks, clips with their fades and warp, alias clips that play another clip's content, notes, the tempo and time signatures, the mix, sends, and the automation of volume, pan and sends. Its equalizer, compressor, gate and limiter become ours with their settings; any other device is left out, and a report says what was, by track. A reversed clip, a clip's gain and the loop have no place in the format: an export says so. A MIDI track that comes in with no instrument gets the one a new MIDI track gets. Times go out in seconds and come in in seconds or beats.
Test: apps/www/test/registry-audio/base/lib/dawproject.test.ts "PRJ-008"; apps/daw/test/browser/run.ts "PRJ-008"
Status: checked against the format's schema and a project written as other DAWs write theirs, not yet against a file another DAW made.

### PRJ-009 A new project
The menu's New project replaces the project with a new one: the two MIDI tracks and the two audio tracks (ARR-009), the two returns, the default tempo, the view laid out afresh. The browser's storage takes the new one within a second, so a reload brings it back and not the one before. As with opening a folder, the project it replaces is not kept anywhere unless it was saved. The reference's Cmd+N is the browser's own (a new window), so there is no key. A new project, like one imported from a `.dawproject` file, belongs to no folder: the folder remembered is forgotten, and the first save after a reload asks for one, so it never writes over the folder of the project before.
Test: apps/daw/test/browser/run.ts "PRJ-009"
