# Projects and files

Keeping the work. The reference saves a set to a file and gathers its samples into a project folder; a browser has no folder of its own to write to, so `apps/daw` keeps the project in the browser's private storage.

### PRJ-001 Saved as you go
Every change is saved within a second, with the audio files it uses; reloading the page brings the project back as it was, its zoom and its scroll included.
Deviation: the reference saves on command. Nothing here is lost on a reload.
Test: apps/daw/test/project.test.ts "PRJ-001"

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
Planned (phase 2): importing its project files, relinking their samples, and playing them with the closest devices this library has.
