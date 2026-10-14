# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Web Audio (audio)

**Impact:** CRITICAL  
**Description:** Getting sound out at all, without clicks, at the right level and in time: the audio context, parameter ramps, gain, scheduling and cleanup.

## 2. Live Data (live)

**Impact:** CRITICAL  
**Description:** Meters, spectra, waveforms and playheads follow signals that change every frame, so they read from sources instead of React state.

## 3. Values & Events (values)

**Impact:** HIGH  
**Description:** How a control's value flows: controlled or uncontrolled, change versus commit, scales, anchors and rejected changes.

## 4. Accessibility (a11y)

**Impact:** HIGH  
**Description:** Every control stays usable with a keyboard, a screen reader and a finger, whatever it looks like.

## 5. Without React (core)

**Impact:** HIGH  
**Description:** Vue, Svelte, Solid, Angular, web components or the plain DOM: the same controls built on the framework-free controllers of `@audio-ui/core`.

## 6. Styling (style)

**Impact:** MEDIUM  
**Description:** Styling the registry components through their props and tokens, and the headless primitives through their state.

## 7. AI Control (ai)

**Impact:** MEDIUM  
**Description:** Letting a model operate the components through typed tools that edit the same state a person does.
