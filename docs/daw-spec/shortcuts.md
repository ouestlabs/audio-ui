# Shortcuts

The reference's keyboard, Mac keys. Each command also lives in the command menu, so a key the browser keeps for itself still has a way in.

## How the keys are held

Every command's keys are declared once, as TanStack Hotkeys app hotkeys (`apps/daw/src/lib/daw/shortcuts.ts`): an id, a name, a group and a default, with second keys beside some (Cmd+Y for redo, Backspace for delete). The shortcuts menu, the menus and the tooltips show them from there, named for the platform (⌘ on a Mac, Ctrl elsewhere), so a key rebound by the user shows as it is. What the user rebinds is kept in this browser, only what differs from the defaults. A key the workstation takes first (typing, the computer's keyboard, Escape, the time selected, the cursor) is not a shortcut too, and a key two chords match runs once.

## Kept by the browser

A page cannot take Cmd+T, Cmd+Shift+T, Cmd+N or Cmd+W in Chrome: they open and close tabs and windows before the page hears them. For those the app answers Ctrl+T, Ctrl+Shift+T and Ctrl+N instead, on every system, and the menus show those.
Status: partial: which other keys Chrome and Safari keep is checked by hand (`apps/daw/test/shortcuts.md`).

## Phase 1

| Rule | Keys | Command |
| --- | --- | --- |
| KEY-001 | Space | Play from the start marker, or stop |
| KEY-002 | Shift+Space | Continue from where playback stopped |
| KEY-034 | F9 | Record on the armed tracks, or end the take (REC-004) |
| KEY-003 | Home, Fn+Left | Start marker to the start |
| KEY-004 | Cmd+L | Loop the selection, or turn the loop on or off |
| KEY-005 | Cmd+Z, Cmd+Shift+Z | Undo, redo |
| KEY-006 | Cmd+T (Ctrl+T) | New audio track |
| KEY-007 | Cmd+Shift+T (Ctrl+Shift+T) | New MIDI track |
| KEY-008 | Cmd+Option+T | New return track |
| KEY-009 | Cmd+R | Rename the selected track or clip |
| KEY-010 | S | Solo the selected tracks |
| KEY-011 | 0 | Deactivate the selected clips or tracks |
| KEY-012 | Delete, Backspace | Delete what is selected: clips, a track, a device |
| KEY-013 | Cmd+E | Split at the cursor or the selection |
| KEY-014 | Cmd+D | Duplicate the selection |
| KEY-015 | Cmd+A | Select all |
| KEY-016 | Cmd+1, Cmd+2, Cmd+3, Cmd+4, Cmd+5 | Narrow, widen, triplet, snap, fixed grid |
| KEY-017 | Cmd+=, Cmd+- | Zoom in, out |
| KEY-018 | Z, X | Zoom to the time selection, and back |
| KEY-019 | U, Option+U | Fold or unfold the selected tracks, unfold all |
| KEY-020 | Cmd+Option+M | Show or hide the mixer |
| KEY-021 | Cmd+Option+B | Show or hide the browser |
| KEY-022 | Shift+Tab | Switch the detail view between the clip and the devices |
| KEY-023 | Cmd+Option+3, Cmd+Option+4 | Show or hide the clip view, the device view |
| KEY-024 | Cmd+Shift+R | Export audio |
| KEY-025 | Cmd+I | Insert silence at the selection |
| KEY-026 | Cmd+Shift+Delete | Delete the selected time |
| KEY-027 | A | Show or hide the automation |
| KEY-028 | M | Add a locator at the cursor |
| KEY-029 | Option+Left, Option+Right | Jump to the previous or next locator or clip edge |
| KEY-030 | Left, Right, End, Up, Down | Move the cursor on the grid, to the last clip's end; pick the track above or below |
| KEY-031 | Cmd+C, Cmd+X, Cmd+V, Cmd+J | Copy, cut, paste; one clip per track of the time selected, rendered (ARR-020) |
| KEY-033 | Cmd+G, Cmd+Shift+G | Group the picked tracks; ungroup the picked group, or the one a picked track is in (MIX-020) |
| KEY-032 | Cmd+O, Cmd+S, Cmd+Shift+S | Open a project folder, save to the project's folder, save to another (PRJ-007); where the browser cannot write a folder, the browser keeps these keys |

Delete takes the selected clips or, with none, a track its header picked: a press on a lane only puts the cursor there (KEY-012, apps/daw/test/browser/run.ts). The menu of the top bar lists every key.

Test: apps/daw/test/shortcuts.test.ts, one case per rule id.
