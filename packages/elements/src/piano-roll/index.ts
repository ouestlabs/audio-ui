/**
 * The piano roll as custom elements. Importing this module registers them,
 * with the timeline the roll sits in and the piano down its side. The rows,
 * the notes and the velocity bars are made from the roll's own notes, each
 * from its template if it has one:
 *
 * ```html
 * <audio-ui-timeline duration="16" snap-step="0.25">
 *   <audio-ui-piano-roll mode="draw">
 *     <audio-ui-timeline-viewport>
 *       <audio-ui-piano-roll-grid aria-label="Notes">
 *         <audio-ui-piano-roll-rows></audio-ui-piano-roll-rows>
 *         <audio-ui-piano-roll-notes>
 *           <template>
 *             <audio-ui-piano-roll-note-handle edge="end"></audio-ui-piano-roll-note-handle>
 *           </template>
 *         </audio-ui-piano-roll-notes>
 *         <audio-ui-timeline-playhead></audio-ui-timeline-playhead>
 *       </audio-ui-piano-roll-grid>
 *     </audio-ui-timeline-viewport>
 *   </audio-ui-piano-roll>
 * </audio-ui-timeline>
 * ```
 */
import "../piano/index.ts";
import "../timeline/index.ts";
import { define, structure } from "../internal/element.ts";
import {
  PIANO_ROLL_TAGS,
  PianoRollElement,
  PianoRollGridElement,
  PianoRollKeysElement,
  PianoRollMarqueeElement,
  PianoRollNoteElement,
  PianoRollNoteHandleElement,
  PianoRollNotesElement,
  PianoRollRowElement,
  PianoRollRowsElement,
  PianoRollSelectionSpanElement,
  PianoRollStretchHandleElement,
  PianoRollVelocitiesElement,
  PianoRollVelocityElement,
  PianoRollVelocityLaneElement,
} from "./elements.ts";

export {
  PIANO_ROLL_TAGS,
  PianoRollElement,
  type PianoRollElementEventMap,
  type PianoRollEventDetail,
  PianoRollGridElement,
  PianoRollKeysElement,
  PianoRollMarqueeElement,
  PianoRollNoteElement,
  PianoRollNoteHandleElement,
  PianoRollNotesElement,
  PianoRollRowElement,
  PianoRollRowsElement,
  PianoRollSelectionSpanElement,
  PianoRollStretchHandleElement,
  PianoRollVelocitiesElement,
  PianoRollVelocityElement,
  PianoRollVelocityLaneElement,
} from "./elements.ts";

const P = PIANO_ROLL_TAGS;
const placed = "left: calc(var(--timeline-unit) * var(--timeline-offset))";
const onRow =
  "top: calc(100% * var(--piano-roll-row) / var(--piano-roll-rows)); height: calc(100% / var(--piano-roll-rows))";

structure(
  `:where(${P.root}, ${P.keys}) { display: block }
:where(${P.grid}, ${P.velocityLane}) { display: block; position: relative; contain: layout style; overflow-x: clip }
:where(${P.grid}) { touch-action: none }
:where(${P.rows}, ${P.notes}, ${P.velocities}) { display: contents }
:where(${P.row}) { display: block; position: absolute; left: 0; right: 0; pointer-events: none; ${onRow} }
:where(${P.note}) { display: block; position: absolute; touch-action: none; ${placed}; width: calc(var(--timeline-unit) * var(--timeline-length)); ${onRow} }
:where(${P.noteHandle}) { display: block; touch-action: none }
:where(${P.marquee}) { display: block; position: absolute; pointer-events: none }
:where(${P.selectionSpan}) { display: block; position: absolute; top: 0; bottom: 0; pointer-events: none; ${placed}; width: calc(var(--timeline-unit) * var(--timeline-length)) }
:where(${P.stretchHandle}) { display: block; position: absolute; top: 0; bottom: 0; pointer-events: auto; touch-action: none }
:where(${P.velocity}) { display: block; position: absolute; bottom: 0; touch-action: none; ${placed}; height: calc(var(--piano-roll-level) * 100%) }`
);

// The roll first, so a part that connects finds it upgraded; each maker before what it makes.
define({
  [P.root]: PianoRollElement,
  [P.keys]: PianoRollKeysElement,
  [P.grid]: PianoRollGridElement,
  [P.rows]: PianoRollRowsElement,
  [P.row]: PianoRollRowElement,
  [P.notes]: PianoRollNotesElement,
  [P.note]: PianoRollNoteElement,
  [P.noteHandle]: PianoRollNoteHandleElement,
  [P.marquee]: PianoRollMarqueeElement,
  [P.selectionSpan]: PianoRollSelectionSpanElement,
  [P.stretchHandle]: PianoRollStretchHandleElement,
  [P.velocityLane]: PianoRollVelocityLaneElement,
  [P.velocities]: PianoRollVelocitiesElement,
  [P.velocity]: PianoRollVelocityElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-piano-roll": PianoRollElement;
    "audio-ui-piano-roll-grid": PianoRollGridElement;
    "audio-ui-piano-roll-keys": PianoRollKeysElement;
    "audio-ui-piano-roll-marquee": PianoRollMarqueeElement;
    "audio-ui-piano-roll-note": PianoRollNoteElement;
    "audio-ui-piano-roll-note-handle": PianoRollNoteHandleElement;
    "audio-ui-piano-roll-notes": PianoRollNotesElement;
    "audio-ui-piano-roll-row": PianoRollRowElement;
    "audio-ui-piano-roll-rows": PianoRollRowsElement;
    "audio-ui-piano-roll-selection-span": PianoRollSelectionSpanElement;
    "audio-ui-piano-roll-stretch-handle": PianoRollStretchHandleElement;
    "audio-ui-piano-roll-velocities": PianoRollVelocitiesElement;
    "audio-ui-piano-roll-velocity": PianoRollVelocityElement;
    "audio-ui-piano-roll-velocity-lane": PianoRollVelocityLaneElement;
  }
}
